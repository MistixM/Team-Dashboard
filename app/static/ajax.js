const userAddForm = document.querySelector('#user-add-form');
const roleAddForm = document.querySelector('#role-add-form');
const userEditForm = document.querySelector('#user-edit-form');

if (userEditForm) {
    userEditForm.addEventListener('submit', async(e) => {
        e.preventDefault();
    
        const formData = new FormData(userEditForm);
        
        try {
            const response = await fetch('/edit-user', {
                method: 'POST',
                body: formData
            });
    
            const result = await response.json();
    
            if (result.success) {
                showMessage(result.message, 'success');
            } else {
                showMessage(result.error);
            }
        } catch (error) {
            showMessage("Server error. Try again later.")
        }
    
    });
}

if (roleAddForm) {
    roleAddForm.addEventListener('submit', async(e) => {
        e.preventDefault();
    
        const formData = new FormData(roleAddForm);
    
        try {
            const response = await fetch('/add-role', {
                method: 'POST',
                body: formData
            });
    
            const result = await response.json();
    
            if (result.success) {
                showMessage(result.message, 'success');
                roleAddForm.reset();
            } else {
                showMessage(result.error);
            }
        } catch (error) {
            showMessage("Server error. Try again later.")
        }
    });
}


if (userAddForm) {

    userAddForm.addEventListener('submit', async(e) => {
        e.preventDefault();
    
        const formData = new FormData(userAddForm);
    
        try {
            const response = await fetch('/user-add', {
                method: 'POST',
                body: formData
            });
    
            const result = await response.json();
    
            if (result.success) {
                showMessage("User registered!", 'success');
                userAddForm.reset();
            } else {
                showMessage(result.error);
            }
        } catch (error) {
            showMessage("Server error. Try again later.");
        }
    
    });
}


function showMessage(msg, status=NaN) {
    const el = document.querySelectorAll('.error-message');

    el.forEach(mblock => {
        mblock.style.display = 'block';
        mblock.textContent = msg;
    
        if (status == 'success') {
            mblock.style.backgroundColor = '#2ed878';
        }
    
        setTimeout(() => {
            mblock.style.display = 'none';
            window.location.reload();
        }, 2000);

    });
    
}

