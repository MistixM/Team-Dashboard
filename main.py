from flask import (Flask, render_template, 
                   url_for, request, make_response,
                   session, redirect, 
                   flash, get_flashed_messages, abort, jsonify)

from flask_login import LoginManager, login_user, logout_user, login_required, current_user

from database.db import init_db, db
from database.models.user import User
from database.models.roles import Roles
from database.models.invoices import InvoiceItem, Invoices
from database.models.todo import Todo
from database.models.availability import Availability
from database.models.events import Event
from database.models.notification import Notification

from sqlalchemy import func

from random_username.generate import generate_username
from utils import check_hash_password, is_safe_url, admin_required, hash_password, generate_random_color, generate_random_icon
from werkzeug.utils import secure_filename

from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from io import BytesIO
from markupsafe import escape

import html
import os
import json

app = Flask(__name__,
            template_folder='app/templates',
            static_folder='app/static',
            instance_relative_config=True)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

app.config.from_pyfile('config.py')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 15 * 1024 * 1024
app.secret_key = app.config['SECRET_KEY']

init_db(app)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.context_processor 
def inject_data():
    if current_user.is_authenticated:
        notifications = Notification.query.filter_by(user_id=current_user.id).all()
        return dict(notifications=notifications)
    return dict(notifications=[])


@app.before_request
def init_table():
    db.create_all()
        
    if Roles.query.count() == 0:
        default_roles = ['admin', 'founder', 'user']

        for role_name in default_roles:
            root = role_name in ['admin', 'user']

            db.session.add(Roles(name=role_name,
                                color=generate_random_color(),
                                icon=generate_random_icon(),
                                root=root))
        
        db.session.commit()

@app.route('/')
def index():
    if current_user.is_authenticated:
        if current_user.role in ['admin', 'founder']:
            return redirect(url_for('admin'))
        return redirect(url_for('team'))   
    return redirect(url_for('login'))


@app.route('/notification/delete', methods=['POST'])
@login_required
def delete_notification():
    data = request.get_json()
    notification_id = data.get('notification_id')
    notification = Notification.query.filter_by(id=notification_id, user_id=current_user.id).first()
    
    if notification:
        db.session.delete(notification)
        db.session.commit()
        return jsonify({'status': 'success'})
    
    return jsonify({'status': 'error', 'message': 'Notification not found'}), 404

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':

        email = request.form['email']
        password = request.form['password'].strip()
        next_page = request.form.get('next') or request.args.get('next') 
        
        if not email or not password:
            return render_template('login.html', error_message="Incorrect data. Please check your email and password.")

        user = User.query.filter_by(email=email).first()

        if user and check_hash_password(user.password, password):
            login_user(user)

            if next_page and is_safe_url(next_page):
                return redirect(next_page)

            if current_user.role == 'admin':
                return redirect(url_for('admin'))
        
            return redirect(url_for('team'))
    
        else:
            return render_template('login.html', error_message="Incorrect data. Please check your email and password.")
    
    if current_user.is_authenticated:
        return redirect(url_for('team'))
    

    next_page = request.args.get('next')

    if next_page: 
        return render_template('login.html', next=next_page)

    return render_template('login.html')


@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('login'))


# Admin routes
@app.route('/admin')
@login_required
def admin():

    if current_user.role not in ['admin', 'founder']:
        return redirect(url_for('team'))

    roles = Roles.query.all()
    invoices = Invoices.query.all()
    invoice_items = Invoices.query.all()

    admins = User.query.filter(User.role.in_(['admin', 'founder'])).all()
    managers = User.query.filter_by(role='manager').all()
    others = User.query.filter(~User.role.in_(['admin', 'manager', 'founder'])).all()

    team_count = User.query.count()
    roles_count = Roles.query.count()

    invoices_total = db.session.query(func.sum(User.invoices_count)).scalar() or 0
    todos_total = db.session.query(func.sum(User.todo_count)).scalar() or 0
    
    for inv in invoice_items:
        inv.items_json = json.dumps([
            {
                'name': item.name,
                'price': item.price,
                'quantity': item.quantity
                
            } for item in inv.items
        ])

    return render_template('admin_panel.html', 
                           active_page='admin', 
                           roles=roles, 
                           admins=admins, 
                           managers=managers, 
                           others=others,
                           team_count=team_count,
                           roles_count=roles_count,
                           invoices_total=invoices_total,
                           todos_total=todos_total,
                           invoices=invoices)


@app.route('/set-note', methods=['POST'])
@admin_required
def set_note():
    invoice_id = request.form.get('invoice_id')
    note = request.form.get('note')
    
    if not invoice_id or not note:
        return redirect(url_for('admin'))
    invoice = Invoices.query.get(invoice_id)
    invoice.note = note 
    
    notification = Notification(user_id=current_user.id,
                                title=f'"{invoice.title[:10]}.." invoice note updated.',
                                redirect=f'/invoices')
    
    db.session.add(notification)
    db.session.commit()

    return redirect(url_for('admin'))


@app.route('/invoices/update_status', methods=['POST'])
@admin_required
def update_inovoice_status():
    invoice_id = request.args.get('invoice_id')
    status = request.args.get('status')

    if not invoice_id or not status:
        return jsonify({'status': 'error', 'message': 'Missing parameters'}), 400

    invoice = Invoices.query.get(invoice_id)

    if not invoice:
        return jsonify({'status': 'error', 'message': 'Invoice not found'}), 404

    invoice.status = status

    if status == 'paid':
        user = User.query.get(invoice.user_id)
        user.revenue += sum(item.price * item.quantity for item in invoice.items)

    db.session.commit()
    
    notification = Notification(user_id=invoice.user_id,
                            title=f'{invoice.title[:10]}.. invoice status updated.',
                            redirect=f'/invoices')

    db.session.add(notification)
    db.session.commit()

    return jsonify({'status': 'success'})


@app.route('/user-add', methods=['POST'])
@admin_required
def user_add():
    if request.method == "POST":
        try:
            email = request.form.get('email')
            password = request.form.get('password').strip()
            role = request.form.get('role')

            if not email or not password or not role:
                return jsonify({'success': False, 'error': 'Invalid data provided.'}), 400

            if User.query.filter_by(email=email).first():
                return jsonify({'success': False, 'error': 'User already exists.'}), 400
            
            hashed_password = hash_password(password)
            name = generate_username()[0]
            new_user = User(email=email, 
                            password=hashed_password, 
                            role=role,
                            name=name,
                            )
            
            db.session.add(new_user)
            db.session.commit()

            notification = Notification(user_id=new_user.id,
                                        title=f'Welcome to the team, {name}! Check out profile.',
                                        redirect=f'/profile')
            db.session.add(notification)
            db.session.commit()
            

            return jsonify({'success': True, 'message': 'User created successfully.'}), 201
        except Exception as e:
            print(f"Server error: {e}")
            return jsonify({'success': False, 'error': 'Internal Error'}), 500
        
    return jsonify({'success': False, 'error': 'Invalid request method.'}), 405

@app.route('/edit-user', methods=['POST'])
@admin_required
def edit_user():
    if request.method == "POST":
        try:
            email = request.form.get('email')
            new_password = request.form.get('new_password', '').strip()
            name = request.form.get('name')
            role = request.form.get('role')
            user_id = request.form.get('user_id')
            action = request.form.get('action')

            if not email or not name or not role or not user_id:
                return jsonify({'success': False, 'error': 'Invalid data provided.'}), 400

            user = User.query.get(int(user_id))

            if not user:
                return jsonify({'success': False, 'error': 'User not found.'}), 404
            
            if action == 'delete':
                if user.id == current_user.id:
                    return jsonify({'success': False, 'error': 'Cannot delete yourself'}), 400
                
                db.session.delete(user)
                db.session.commit()
                return jsonify({'success': True, 'message': 'User deleted successfully'}), 201
            
            existing_user = User.query.filter(User.email == email, User.id != int(user_id)).first()
            if existing_user:
                return jsonify({'success': False, 'error': 'This email is already taken.'}), 400
            
            user.name = name
            user.role = role
            user.email = email

            if new_password:
                user.password = hash_password(new_password)

            db.session.commit()

            return jsonify({'success': True, 'message': 'User updated successfully.'}), 201

        except Exception as e:
            print(f"Server error: {e}")
            return jsonify({'success': False, 'error': 'Internal Error'}), 500


@app.route('/remove-role', methods=['POST'])
@admin_required
def remove_role():
    role_id = request.form.get('role_id')

    if not role_id:
        return redirect(url_for('admin'))

    role = Roles.query.get(role_id)

    if role.name in ['admin', 'user']:
        return redirect(url_for('admin'))
    
    if not role:
        return redirect(url_for('admin'))
    
    users = User.query.filter_by(role=role.name).all()

    for user in users:
        user.role = 'user'
    
    db.session.delete(role)
    db.session.commit()

    return redirect(url_for('admin'))

@app.route('/add-role', methods=['POST'])
@admin_required
def add_role():
    if request.method == 'POST':
        try:
            role_name = request.form.get('role_name').strip().lower()

            if not role_name:
                return jsonify({'success': False, 'error': 'Please provide role name.'}), 400

            if Roles.query.filter_by(name=role_name).first():
                return jsonify({'success': False, 'error': 'This role already exists.'}), 400

            new_role = Roles(name=role_name.lower(),
                            color=generate_random_color(),
                            icon=generate_random_icon(),
                            root=False)
            
            db.session.add(new_role)
            db.session.commit()

            return jsonify({'success': True, 'message': 'New role created!'}), 201
        except Exception as e:
            print(e)
            return jsonify({'success': False, 'error': 'Internal Error'}), 500
        
    return jsonify({'success': False, 'error': 'Invalid request method.'}), 405


@app.route('/team')
@login_required
def team():
    admins = User.query.filter(User.role.in_(['admin', 'founder'])).all()
    managers = User.query.filter_by(role='manager').all()
    others = User.query.filter(~User.role.in_(['admin', 'manager', 'founder'])).all()

    return render_template('team.html', 
                           active_page='team',
                           admins=admins,
                           managers=managers,
                           others=others)


# FIXED: change on prod
@app.route('/invoices/filter')
@login_required
def invoice_filter():
    status = request.args.get('status')

    is_admin = 'admin' in request.referrer


    if is_admin and current_user.role == 'admin':
        if status == 'all':
            invoice_items = Invoices.query.all()
        else:
            invoice_items = Invoices.query.filter_by(status=status).all()
    else:
        invoice_items = Invoices.query.filter_by(status=status, user_id=current_user.id).all()

    return jsonify([
        {
            'id': inv.id,
            'title': inv.title,
            'status': inv.status,
            'color': inv.color,
            'from': inv.from_address,
            'date_created': inv.date_created,
            'note': inv.note,
            'items_json': [
                {'name': escape(item.name), 'price': item.price, 'quantity': item.quantity}
                for item in inv.items
            ]
        }
        for inv in invoice_items
    ])

@app.route('/invoices')
@login_required
def invoices():

    invoice_items = Invoices.query.filter_by(status="requested", user_id=current_user.id).all()

    # for inv in invoice_items:
    #     inv.items_json = html.escape(json.dumps([
    #         {
    #             'name': escape(item.name),
    #             'price': item.price,
    #             'quantity': item.quantity
                
    #         } for item in inv.items
    #     ]))

    for inv in invoice_items:
        inv.items_json = json.dumps([
            {'name': escape(item.name), 'price': item.price, 'quantity': item.quantity}
            for item in inv.items
    ])
    
    return render_template(
        'invoices.html',
        active_page='invoices',
        _invoices=invoice_items
    )

@app.route('/remove-invoice', methods=['POST'])
@login_required
def remove_invoice():
    invoice_id = request.form.get('invoice_id')

    if not invoice_id:
        return redirect(url_for('invoices'))

    invoice = Invoices.query.get(invoice_id)

    if not invoice:
        return redirect(url_for('invoices'))

    if current_user.invoices_count > 0:
        current_user.invoices_count -= 1

    db.session.delete(invoice)
    db.session.commit()

    return redirect(url_for('invoices'))


@app.route('/invoice-upload', methods=['POST'])
@login_required
def invoice_upload(): 

    title = request.form.get('title')
    date = request.form.get('date')
    from_address = request.form.get('from', '').strip()

    item_names = request.form.getlist('item_name[]')
    item_prices = request.form.getlist('item_price[]')
    item_qtys = request.form.getlist('item_qty[]')
   
    if not title or not date or not item_names or not from_address:
        return redirect(url_for('invoices'))

    invoice = Invoices(
        title=escape(title),
        date_created=date,
        user_id=current_user.id,
        color=generate_random_color(),
        from_address=from_address
    )

    db.session.add(invoice)
    db.session.flush()

    for name, price, qty in zip(item_names, item_prices, item_qtys):
        item = InvoiceItem(
            invoice_id=invoice.id,
            name=escape(name),
            price=float(price),
            quantity=int(qty)
        )

        db.session.add(item)
    
    current_user.invoices_count += 1

    db.session.commit()

    return redirect(url_for('invoices'))

@app.route('/download-invoice-pdf/<int:invoice_id>', methods=['GET'])
@login_required
def download_invoice_pdf(invoice_id):
    invoice = Invoices.query.get_or_404(invoice_id)
    items = InvoiceItem.query.filter_by(invoice_id=invoice_id).all()
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Header
    story.append(Paragraph("<b>Team Dashboard</b>", styles['Title']))
    story.append(Paragraph("255 S Orange Avenue<br/>Suite 104 #2397<br/>Orlando, FL, 23801", styles['Normal']))
    story.append(Spacer(1, 20))
    
    story.append(Paragraph(f"From: {invoice.from_address}"))
    story.append(Spacer(1, 20))

    # Invoice info
    story.append(Paragraph(f"<b>Invoice #{invoice.id}</b>", styles['Heading2']))
    story.append(Paragraph(f"Date: {invoice.date_created}", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Items table
    table_data = [['Description', 'Quantity', 'Price', 'Amount']]
    total = 0.0
    
    for item in items:
        item_total = item.price * item.quantity
        total += item_total
        table_data.append([
            item.name, 
            str(item.quantity),
            f"${item.price:.2f}",
            f"${item_total:.2f}"
        ])
    
    # Add total row
    table_data.append(['', '', 'Total', f'${total:.2f}'])
    
    table = Table(table_data, colWidths=[200, 60, 80, 80])
    table.setStyle(TableStyle([
        # Header row styling
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        
        # Data rows styling
        ('BACKGROUND', (0, 1), (-1, -2), colors.white),
        ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),  # Right align numbers
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),    # Left align descriptions
        
        # Total row styling
        ('BACKGROUND', (0, -1), (-1, -1), colors.beige),
        ('FONTNAME', (2, -1), (-1, -1), 'Helvetica-Bold'),
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    story.append(table)
    
    # Add note if exists
    if invoice.note and invoice.note != 'No additional notes provided.':
        story.append(Spacer(1, 20))
        story.append(Paragraph("<b>Notes:</b>", styles['Heading3']))
        story.append(Paragraph(invoice.note, styles['Normal']))
    
    doc.build(story)
    
    buffer.seek(0)
    
    response = make_response(buffer.getvalue())
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'attachment; filename=invoice_{invoice.id}.pdf'
    
    return response


@app.route('/todo')
@login_required
def todo():
    todos = Todo.query.filter_by(user_id=current_user.id).all()

    return render_template('todo.html', 
                           active_page='todo',
                           todos=todos)


@app.route('/update-todo', methods=['POST'])
@login_required
def update_todo():
    
    if request.args.get('todo_id'):
        todo_id = request.args.get('todo_id')
        todo = Todo.query.get(todo_id)

        todo_id = request.args.get('todo_id')
        status = request.args.get('status')

        if not todo:
            return jsonify({'status': 'error', 'message': 'Todo not found or access denied'}), 404

        if status == 'removed':
            if current_user.todo_count > 0:
                current_user.todo_count -= 1

            db.session.delete(todo)
            db.session.commit()
            return jsonify({'status': 'success', 'message': 'Todo removed successfully'})
                
        todo.status = status

        db.session.commit()
        
        return jsonify({'status': 'success', 'message': 'Todo updated successfully'})

    todo_id = request.form.get('todo_id')
    title = request.form.get('title').strip()
    description = request.form.get('description').strip()
    links = request.form.get('links', '')
    deadline = request.form.get('date').strip()

    if not todo_id or not title or not description or not deadline:
        return redirect(url_for('todo'))
    
    todo = Todo.query.get(todo_id)

    todo.title = title
    todo.description = description
    todo.links = links
    todo.deadline = deadline

    db.session.commit()

    return redirect(url_for('todo'))


@app.route('/add-todo', methods=['POST'])
@login_required
def add_todo():
    title = request.form.get('title').strip()
    description = request.form.get('description').strip()
    links = request.form.get('links').strip()
    deadline = request.form.get('date').strip()
    
    if not title or not description or not deadline:
        return redirect(url_for('todo'))
    
    _todo = Todo(
        title=title,
        description=description,
        links=links,
        status='doing',
        color=generate_random_color(),
        deadline=deadline,
        user_id=current_user.id
    )

    calendar = Event(
        user_id=current_user.id,
        start_date=datetime.fromisoformat(deadline),
        title=f"ToDo: {title}"
    )

    current_user.todo_count += 1
    db.session.add(_todo)
    db.session.add(calendar)

    db.session.commit()

    return redirect(url_for('todo'))


@app.route('/calendar')
@login_required
def handle_calendar():
    return render_template('calendar.html', active_page='calendar')

@app.route('/events/remove', methods=['POST'])
@login_required
def remove_event():
    data = request.get_json()
    event_id = data.get('event_id')
    
    event = Event.query.filter_by(id=event_id, user_id=current_user.id).first()
    if event:
        db.session.delete(event)
        db.session.commit()
        return jsonify({'status': 'success'})
    
    return jsonify({'status': 'error', 'message': 'Event not found'})

@app.route('/view-user-events', methods=['GET'])
@login_required
def view_user_events():
    user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({'status': 'error', 'message': 'User ID is required'}), 400
    
    events = Event.query.filter_by(user_id=user_id).all()

    return jsonify([
        {
            "id": ev.id,
            "start_date": ev.start_date.strftime('%Y-%m-%d'), 
            "title": ev.title,
        }
        for ev in events
    ])


@app.route('/events/get')
@login_required
def get_events():
    events = Event.query.filter_by(user_id=current_user.id).all()
    
    return jsonify([
        {
            "id": ev.id,
            "start_date": ev.start_date.strftime('%Y-%m-%d'), 
            "title": ev.title,
        }
        for ev in events
    ])


@app.route('/events/save', methods=['POST'])
@login_required
def save_events():
    data = request.get_json()
    events = data.get('events', [])

    for ev in events:

        db.session.add(Event(user_id=current_user.id, 
                             start_date=datetime.fromisoformat(ev['start']), title=ev['title']))

    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Availability saved successfully'})


@app.route('/availability/save', methods=['POST'])
@login_required
def save_availability():
    data = request.get_json()
    events = data.get('events', [])

    Availability.query.filter_by(user_id=current_user.id).delete()

    for ev in events:
        print(f"Original start: {ev['start']}")
        
        # Parse the ISO string properly handling timezone
        if ev['start'].endswith('Z'):
            # Remove Z and parse as UTC
            dt = datetime.fromisoformat(ev['start'].replace('Z', '+00:00'))
        else:
            dt = datetime.fromisoformat(ev['start'])
        
        # Extract just the date part (ignoring time/timezone)
        start_date = dt.date()
        print(f"Parsed date: {start_date}")
        
        db.session.add(Availability(user_id=current_user.id, start_date=start_date))

    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Availability saved successfully'})

@app.route('/availability/get')
@login_required
def get_availability():

    events = Availability.query.filter_by(user_id=current_user.id).all()
    
    user_id = request.args.get('user_id')
    if user_id:
        events = Availability.query.filter_by(user_id=user_id).all()
    
    return jsonify([
        {
            "start": ev.start_date.strftime('%Y-%m-%d'),  # Just date, no time
            "allDay": True
        }
        for ev in events
    ])


@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html', active_page='profile')

@app.route('/edit-profile', methods=['POST'])
@login_required
def edit_profile():
    name = request.form.get('name').strip()
    bio = request.form.get('bio').strip()
    email = request.form.get('email')

    existing_user = User.query.filter_by(email=email).first()
    if existing_user and existing_user.id != current_user.id:
        flash("This email already exists", 'warning')
        return redirect(url_for('profile'))

    if len(name) > 20:
        flash("Name is too long", 'warning')
        return redirect(url_for('profile'))
 
    if len(bio) > 100:
        flash("Bio is too long", 'warning')
        return redirect(url_for('profile'))

    if len(email) > 50:
        flash("Email is too long", 'warning')
        return redirect(url_for('profile'))

    if not name or not bio or not email:
        flash('Please fill out all fields.', 'warning')
        return redirect(url_for('profile'))
    
    current_user.name = name
    current_user.bio = escape(bio)
    current_user.email = email

    db.session.commit()

    flash('Profile updated successfuly!', 'info')
    return redirect(url_for('profile'))


@app.errorhandler(413)
def handle_413(error):
    return redirect(url_for('profile'))


@app.route('/upload-avatar', methods=['POST'])
@login_required
def upload_avatar():

    if request.method == 'POST':
        file = request.files.get('avatar')

        if file and '.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']:
            filename = secure_filename(file.filename)
            user_id = current_user.id
            file_ext = filename.rsplit('.', 1)[1].lower()
            avatar_filename = f"user_{user_id}.{file_ext}"

            file.save(os.path.join(app.config['UPLOAD_FOLDER'], avatar_filename))

            current_user.profile_img = f"images/{avatar_filename}"
            db.session.commit()

            return redirect(url_for('profile'))

    return redirect(url_for('profile'))
    
@app.route('/delete-avatar', methods=['POST'])
@login_required
def delete_avatar():
    current_user.profile_img = f'images/default-profile.jpg'
    db.session.commit()

    return redirect(url_for('profile'))


if __name__ == "__main__":
    app.run(port=5050, debug=True)