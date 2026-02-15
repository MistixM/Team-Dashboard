import random

from urllib.parse import urlparse, urljoin  
from functools import wraps

# Flask related
from flask_bcrypt import Bcrypt
from flask import request, redirect, url_for
from flask_login import current_user

# Hash password with Bcrypt.
def hash_password(password):
    bcrypt = Bcrypt()
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    return hashed_password


# If required, check hashed password with provided.
def check_hash_password(h_password, password):
    bcrypt = Bcrypt()

    return bcrypt.check_password_hash(h_password, password)

def is_safe_url(target):
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return (
        test_url.scheme in ('http', 'https') and
        ref_url.netloc == test_url.netloc
    )


def generate_random_color():
    colors = ['#E3B200',
              '#00E390',
              '#006AE3',
              '#6E00E3']
    
    return random.choice(colors)


def generate_random_icon():
    icons = ['images/key.svg',
             'images/pin.svg',
             'images/globus.svg']
    
    return random.choice(icons)


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            redirect(url_for('team'))
        return f(*args, **kwargs)
    return wrapper