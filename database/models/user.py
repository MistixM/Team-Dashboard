from database.db import db
from flask_login import UserMixin

from datetime import datetime

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    name = db.Column(db.String(20), nullable=False)
    bio = db.Column(db.String(100), nullable=False, default='Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat')
    invoices_count = db.Column(db.Integer, nullable=False, default=0)
    todo_count = db.Column(db.Integer, nullable=False, default=0)
    revenue = db.Column(db.Integer, nullable=False, default=0)
    profile_img = db.Column(db.String(50), nullable=False, default='images/default-profile.jpg')
    joined = db.Column(db.String(10), nullable=False, default=datetime.now().strftime('%d.%m.%Y'))