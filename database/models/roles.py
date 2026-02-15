from database.db import db
from flask_login import UserMixin

class Roles(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    color = db.Column(db.String(50), nullable=False)
    icon = db.Column(db.String(50), nullable=False)
    root = db.Column(db.Boolean, default=False)
    
    def __repr__(self):
        return f"<Role: {self.name}>"