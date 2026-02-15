from database.db import db
from flask_login import UserMixin

class Notification(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    redirect = db.Column(db.String(50), nullable=False)