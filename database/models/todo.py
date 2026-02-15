from database.db import db
from flask_login import UserMixin


class Todo(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    links = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='doing')
    color = db.Column(db.String(50), nullable=False)
    deadline = db.Column(db.String(25), nullable=False)
    user_id = db.Column(db.String(255), nullable=False)