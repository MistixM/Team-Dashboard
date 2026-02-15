from database.db import db
from flask_login import UserMixin


class Invoices(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date_created = db.Column(db.String(25), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='requested')
    pdf_file = db.Column(db.String(255))
    items = db.relationship('InvoiceItem', backref='invoice', lazy=True, cascade="all, delete-orphan")
    color = db.Column(db.String(50), nullable=False)
    from_address = db.Column(db.String(255), nullable=False)
    note = db.Column(db.String(255), nullable=True, default='No additional notes provided.')
    
    def __repr__(self):
        return f"<Invoice: {self.title}>"


class InvoiceItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

    def __repr__(self):
        return f"<Invoice item: {self.name}>"