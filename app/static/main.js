
document.addEventListener("DOMContentLoaded", function () {

    // Calendar stuff
    if (typeof FullCalendar != 'undefined') {
        const calendarEl = document.getElementById('calendar');
        let availabilityMode = false;
        let availabilityEvents = [];
        let events = [];

        // Helper function to format date consistently
        function formatDateForBackend(date) {
            // Get the local date string in YYYY-MM-DD format
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}T00:00:00`;
        }

        // Click handler for status button
        const statusClickHandler = function () {
            availabilityMode = !availabilityMode;
            console.log('Availability mode:', availabilityMode);

            // Change button text
            calendar.setOption('customButtons', {
                statusBtn: {
                    text: availabilityMode ? 'Save availability' : 'Set availability',
                    click: statusClickHandler
                }
            });

            // Save to backend
            if (!availabilityMode) {
                console.log("Saving availability to DB:", availabilityEvents);

                // Prepare data with consistent date formatting
                const saveData = availabilityEvents.map(ev => {
                    const dateStr = formatDateForBackend(new Date(ev.start));
                    console.log('Sending date:', dateStr);
                    return {
                        start: dateStr
                    };
                });

                fetch("/availability/save", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ events: saveData })
                })
                .then(res => res.json())
                .then(data => {
                    console.log("Save response:", data);
                    if (data.status === "success") {
                        loadAvailabilityText(saveData);
                    }
                });
            }
        };

        // Init calendar
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'statusBtn'
            },
            customButtons: {
                statusBtn: {
                    text: 'Set availability',
                    click: statusClickHandler
                }
            },
            events: [], // Will load from backend
            selectable: true,
            eventClick: function (info) {
                if (info.event.extendedProps.type === 'availability'){
                    console.log(info.event.extendedProps)
                    info.event.remove();
                } else if (info.event.extendedProps.eventId) {
                    fetch("/events/remove", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ event_id: info.event.extendedProps.eventId })
                    })
                    .then(res => res.json())
                    .then(data => {
                        console.log("Remove response:", data);
                        if (data.status === "success") {
                            info.event.remove();
                        }
                    });
                }

                // if (info.event.extendedProps.type === 'availability') {
                //     info.event.remove();
                // }
            },
            select: function (info) {
                if (!availabilityMode) return;

                const clickedDate = new Date(info.start).toISOString().split('T')[0];
                
                const existingEvent = calendar.getEvents().find(event => {
                    const eventDate = new Date(event.start).toISOString().split('T')[0];
                    return eventDate === clickedDate && event.extendedProps.type === 'availability';
                });

                if (existingEvent) {
                    existingEvent.remove();
                    const index = availabilityEvents.findIndex(ev =>
                        new Date(ev.start).toISOString().split('T')[0] === clickedDate
                    );
                    if (index !== -1) {
                        availabilityEvents.splice(index, 1);
                    }
                } else {
                    const eventObject = {
                        start: info.start,
                        display: 'background',
                        backgroundColor: '#28a745',
                        borderColor: '#28a745',
                        extendedProps: {
                            type: 'availability'
                        },
                        allDay: true
                    };

                    calendar.addEvent(eventObject);
                    availabilityEvents.push(eventObject);
                }

                // Update availabilityEvents array
                availabilityEvents = calendar.getEvents()
                .filter(ev => ev.extendedProps.type === 'availability')
                .map(ev => ({
                    start: new Date(ev.start),
                    end: new Date(ev.end),
                    display: ev.display,
                    backgroundColor: ev.backgroundColor,
                    borderColor: ev.borderColor,
                    extendedProps: ev.extendedProps,
                    allDay: ev.allDay
                }));
            }
        });

        fetch("/events/get")
        .then(res => res.json())
        .then(data => {
            data.forEach(ev => {
                const eventObject = {
                    start: ev.start_date,
                    title: ev.title,
                    allDay: true,
                    extendedProps: { eventId: ev.id }
                }

                console.log('Adding event:', eventObject);
                calendar.addEvent(eventObject);
            });
            loadAvailabilityText(data);
        });

        // Load events from backend
        fetch("/availability/get")
            .then(res => res.json())
            .then(data => {
                console.log('Loaded availability:', data);
                data.forEach(ev => {
                    const eventObject = {
                        start: ev.start, // Use the date string directly
                        display: 'background',
                        backgroundColor: '#28a745',
                        borderColor: '#28a745',
                        extendedProps: { type: 'availability' },
                        allDay: true
                    };
                    calendar.addEvent(eventObject);
                    availabilityEvents.push(eventObject);
                });
                loadAvailabilityText(data);
            });

        const setEventBtn = document.querySelector('#calendar-add-btn');
        const titleInput = document.querySelector('#event-title-input');
        const dateInput = document.querySelector('#date-block-add');
        const modal = document.querySelector('#calendar-add-event-popup');

        if (setEventBtn) {
            setEventBtn.addEventListener('click', function(e) {
                e.preventDefault();
                
                const title = titleInput.value.trim();
                const selectedDate = dateInput.value;
        
                if (title && selectedDate) {
                    // Create the event

                    let eventObject = {
                        title: title,
                        start: selectedDate,
                        allDay: true
                    }

                    calendar.addEvent(eventObject);
        
                    // Close modal and reset form
                    modal.classList.remove('show');
                    titleInput.value = '';
                    dateInput.value = '';
                    
                    events.push(eventObject);

                    console.log(events);

                    fetch("/events/save", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ events: events })
                    })
                    .then(res => res.json())
                    .then(data => {
                        console.log("Save response:", data);
                    });
                }
            });        
        }

        calendar.render();

        function loadAvailabilityText(events) {
            const container = document.getElementById("availability-text");
            if (!container) return;

            if (events.length === 0) {
                container.textContent = "No availability set.";
                return;
            }

            let ranges = events.map(ev => {
                const date = ev.start.split('T')[0]; // Extract just the date part
                return date;
            });
            container.textContent = "Available: " + ranges.join(", ");
        }
    }

    document.querySelector('.notification-popup-content')?.addEventListener('click', function(e) {
        const openBtn = e.target.closest('a[data-id]');
        console.log(openBtn);

        if (openBtn) {
            const notificationId = openBtn.getAttribute('data-id');
            fetch(`/notification/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: notificationId })
            })
            .then(res => res.json());
        }
    });

    const bell = document.getElementById('notification-btn');
    const popup = document.getElementById('notification-popup');

    if (bell) {
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
        });
        
            // Hide popup when clicking outside
            document.addEventListener('click', () => {
                popup.style.display = 'none';
            });
        
            popup.addEventListener('click', (e) => {
                e.stopPropagation(); 
            });
    }

    // Popup stuff
    document.querySelectorAll('.overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target !== overlay) return;

            overlay.classList.remove('show');
        });
    });

    function openPopup(id) {
        const overlay = document.getElementById(id);
        overlay.classList.add('show');
    }

    function closePopup(id) {
        const overlay = document.getElementById(id);
        if (!overlay) return;

        overlay.classList.remove('show');
    }

    document.querySelectorAll('.add-user-btn').forEach(btn => {

        btn.addEventListener('click', () => {

            const type = btn.getAttribute('data-type');

            if (type === 'users') {
                openPopup('user-add-popup');
            } else if (type === 'role') {
                openPopup('role-add-popup');
            }
        });
    });


    // document.querySelectorAll('#view-user').forEach(btn => {
    //     btn.addEventListener('click', () => {
    //         openPopup('profile-details-popup');
    //     });
    // });

    document.querySelectorAll('.profile-buttons').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const calendarBtn = e.target.closest('#profile-calendar');

            if (calendarBtn) {
                openPopup('profile-calendar-popup');
                const userId = calendarBtn.dataset.id;
    
                const calendarEl = document.getElementById('calendar');
                if (calendarEl) {
                    calendarEl.innerHTML = ''; 
                    const calendar = new FullCalendar.Calendar(calendarEl, {
                        initialView: 'dayGridMonth',
                        headerToolbar: {
                            left: 'prev,next',
                            center: 'title',
                            right: NaN
                        },
                        events: [],
                        selectable: false,
                    });
                    
                    fetch(`/availability/get?user_id=${userId}`)
                    .then(response => response.json())
                    .then(data => {
                        data.forEach(ev => {
                            const eventObject = {
                                start: new Date(ev.start),
                                display: 'background',
                                backgroundColor: '#28a745',
                                borderColor: '#28a745',
                                extendedProps: { type: 'availability' },
                                allDay: true
                            };
                            calendar.addEvent(eventObject);
                        });
                    });

                    fetch(`/view-user-events?user_id=${userId}`)
                    .then(response => response.json())
                    .then(data => {
                        data.forEach(ev => {
                            const eventObject = {
                                start: new Date(ev.start_date),
                                title: ev.title,
                                allDay: true,
                                extendedProps: { eventId: ev.id }
                            };
                            calendar.addEvent(eventObject);
                        });
                    });
                    calendar.render();
                }
            }
        });

    });

    document.querySelectorAll('#view-user').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('clciked');
            
            const name = btn.dataset.name
            const email = btn.dataset.email
            const role = btn.dataset.role
            const bio = btn.dataset.bio
            const joined = btn.dataset.joined
            const profile_img = btn.dataset.profileImg 
            const user_id = btn.dataset.id;

            const popup = document.querySelector('.profile-details-popup');
            popup.querySelector('.login-form-title').textContent = `${name} Profile`;
            
            const details = popup.querySelector('.profile-details-data');
            details.innerHTML = `
                <p><span style="font-weight: 500;">Name:</span> ${name}</p>
                <p><span style="font-weight: 500;">Bio:</span> ${bio}</p>
                <p><span style="font-weight: 500;">Role:</span> ${role}</p>
                <a href="mailto:${email}"><span style="font-weight: 500;">Email:</span> ${email}</a>
                <p><span style="font-weight: 500;">Joined:</span> ${joined}</p>
            `;

            popup.querySelector('img').src = `static/${profile_img}`;
            popup.querySelector('img').width = 140;
            popup.querySelector('img').height = 140;
            popup.querySelector('img').style = "border-radius: 50%; object-fit:cover"
            
            document.querySelector('#profile-calendar')?.remove();

            const calendarEl = document.createElement('button');
            calendarEl.id = 'profile-calendar';
            calendarEl.className = 'profile-details-btn';
            calendarEl.textContent = 'View Calendar';
            calendarEl.dataset.id = user_id;

            document.querySelector('.calendar-user-name').textContent = `${name}'s Calendar`
            document.querySelector('.profile-buttons').appendChild(calendarEl);

            openPopup('profile-details-popup');
        });
    });

    document.querySelectorAll('#edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name
            const email = btn.dataset.email
            const role = btn.dataset.role
            const user_id = btn.dataset.userId
            
            const editUserForm = document.querySelector('#user-edit-form');

            document.querySelector('.user-name-title').textContent = `Edit ${name}`;
            editUserForm.querySelector('input[name="name"]').value = name;
            editUserForm.querySelector('input[name="email"]').value = email;
            editUserForm.querySelector('select[name="role"]').value = role;
            editUserForm.querySelector('#user-id-input').value = user_id;

            openPopup('user-edit-popup');
        });
    });

    document.querySelectorAll('#delete-role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const roleId = btn.getAttribute('data-role-id')
            document.querySelector('#role-id-input').value = roleId
            openPopup('role-removal-popup');
        });
    });


    // document.querySelectorAll('.decline').forEach(btn => {
    //     btn.addEventListener('click', (e) => {

    //     });
    // });

    document.querySelectorAll('#todo-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const todoId = btn.dataset.todoId;

            fetch(`/update-todo?todo_id=${todoId}&status=removed`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.reload();
                }
            });
        });
    });

    document.querySelectorAll('#todo-done').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const todoId = btn.dataset.todoId;
            fetch(`/update-todo?todo_id=${todoId}&status=done`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.reload();
                }
            });
        });
    });

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('paid')) {
            invoiceID = e.target.getAttribute('data-invoice-id');
            fetch(`/invoices/update_status?invoice_id=${invoiceID}&status=paid`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.reload();
                }
            });
        }

        if (e.target.classList.contains('decline')) {
            invoiceID = btn.getAttribute('data-invoice-id');
            fetch(`/invoices/update_status?invoice_id=${invoiceID}&status=declined`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    window.location.reload();
                }
            });
        }
    });

    document.querySelectorAll('.invoice-buttons').forEach(item => {
        
        item.addEventListener('click', (e) => {
            const btn = e.target.closest('#download-pdf-btn');

            if (btn) {
                const invoiceId = btn.dataset.invoiceId; // Add data-invoice-id to button
                window.location.href = `/download-invoice-pdf/${invoiceId}`;
            }
        });

    });
    

    document.querySelectorAll('.user_cards').forEach(card => {
        card.addEventListener('click', (e) => {
            const invoiceBtn = e.target.closest('.delete-invoice');
        
            if (invoiceBtn) {
                const invoiceId = invoiceBtn.getAttribute('data-invoice-id');
                document.querySelector('#invoice-id-input').value = invoiceId;
                openPopup('invoice-removal-popup');
            }
        
            const btn = e.target.closest('.details');
            
            if (btn) {
                
                console.log(btn.dataset.items);

                const items = JSON.parse(btn.dataset.items);

                const tbody = document.querySelector("#invoice-details-popup tbody");
                tbody.innerHTML = ""
        
                let total = 0;
                
                items.forEach(item => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td style="padding: 8px; color: var(--text-color-primary)">${item.name}</td>
                        <td style="padding: 8px; text-align: right; color: var(--text-color-primary)">${item.quantity}</td>
                        <td style="padding: 8px; text-align: right; color: var(--text-color-primary)">$${item.price}</td>
                        `;
                    tbody.appendChild(row);
                    total += item.price * item.quantity;
                });
        
                document.querySelector('#status-notes').innerHTML = `
                    <p><strong>Status:</strong> <span style="color: ${btn.dataset.status === 'paid' ? 'green' : 'yellow'};">${btn.dataset.status.charAt(0).toUpperCase() + btn.dataset.status.slice(1)}</span></p>
                    <p><strong>Notes:</strong> ${btn.dataset.note || 'No notes available'}</p>
                `;
        
                document.querySelector('#billing-info').innerHTML = `
                    <p><strong>Billed To:</strong></p>
                    <p style="margin: 4px 0;">${btn.dataset.from}</p>
                `;
        
                document.querySelector('#invoice-date').textContent = `Date: ${btn.dataset.date}`;
                document.querySelector('#invoice-number').textContent = `Invoice #: ${btn.dataset.number}`;
                document.querySelector('.invoice-details-title').textContent = `View ${btn.dataset.name} invoice`;

                document.querySelector("#invoice-details-popup tfoot td:last-child").innerHTML = `<strong>$${total.toFixed(2)}</strong>`;
                

                if (btn.dataset.root === "true") {
                    document.querySelector('#invoice-set-note')?.remove();
                    document.querySelector('#download-pdf-btn')?.remove();

                    const note = document.createElement('button');
                    note.class = 'invoice-details-btn';
                    note.id = 'invoice-set-note';
                    note.textContent = 'Set note';
                    note.dataset.invoiceId = btn.dataset.number;

                    const pdfdownloadBtn = document.createElement('button');
                    pdfdownloadBtn.textContent = 'Download PDF';
                    pdfdownloadBtn.class = 'invoice-details-btn';
                    pdfdownloadBtn.id = 'download-pdf-btn';
                    pdfdownloadBtn.dataset.invoiceId = btn.dataset.number;

                    document.querySelector('.invoice-buttons').appendChild(note);
                    document.querySelector('.invoice-buttons').appendChild(pdfdownloadBtn);
                    
                }   
                document.querySelector('#download-pdf-btn')?.remove();
                
                const pdfdownloadBtn = document.createElement('button');
                pdfdownloadBtn.textContent = 'Download PDF';
                pdfdownloadBtn.classList.add('invoice-details-btn');
                pdfdownloadBtn.id = 'download-pdf-btn';
                pdfdownloadBtn.dataset.invoiceId = btn.dataset.number;
                
                document.querySelector('.invoice-buttons').appendChild(pdfdownloadBtn);
                openPopup('invoice-details-popup');
            }
        });
    });

    
    document.querySelector('.invoice-buttons')?.addEventListener('click', (e) => {
        const target = e.target.closest('#invoice-set-note');

        if (!target) return;

        closePopup('invoice-details-popup');

        const invoiceId = target.dataset.invoiceId;
        const invoiceIdInput = document.createElement('input');
        invoiceIdInput.type = 'hidden';
        invoiceIdInput.name = 'invoice_id';
        invoiceIdInput.value = invoiceId;
        
        const invoiceForm = document.querySelector('#invoice-form');

        invoiceForm.querySelector('input[name="invoice_id"]')?.remove();
        invoiceForm.appendChild(invoiceIdInput);

        openPopup('invoice-set-note-popup');
    });
    

    document.querySelectorAll('#note-back').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();

            closePopup('invoice-set-note-popup')

            openPopup('invoice-details-popup');
        });
    });

    document.querySelectorAll('#upload-invoice').forEach(btn => {
        btn.addEventListener('click', () => {
            openPopup('invoice-upload-popup');
        });
    });

    document.querySelectorAll('#invoice-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();

            closePopup('invoice-upload-popup');
        });
    });

    document.querySelector('#set-event')?.addEventListener('click', () => {
        openPopup('calendar-add-event-popup');
    });

    document.querySelectorAll('[data-popup-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const popupId = btn.getAttribute('data-popup-close');
            const popup = document.getElementById(popupId);
            if (popup) closePopup(popupId);
        });
    });

    document.querySelector('#todo-create')?.addEventListener('click', () => {
        openPopup('todo-create-popup');
    });

    document.querySelector('#todo-close')?.addEventListener('click', () => {
        closePopup('todo-edit-popup');
    });

    document.querySelectorAll('#todo-view-details').forEach(btn => {
        btn.addEventListener('click', () => {
            
            const title = btn.dataset.name;
            const description = btn.dataset.description;
            const links = btn.dataset.links;
            const date = btn.dataset.deadline || '';

            console.log(title, description, links);

            const todoDetails = document.querySelector('.todo-inputs');
            todoDetails.querySelector('.title-block input').value = title;
            todoDetails.querySelector('.description-block input').value = description;
            todoDetails.querySelector('.links-block input').value = links;
            todoDetails.querySelector('.date-block input').value = date;

            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'todo_id';
            hiddenInput.value = btn.dataset.todoId;
            todoDetails.appendChild(hiddenInput);

            openPopup('todo-edit-popup');
        });
    });

    document.querySelector('.logout-button')?.addEventListener('click', () => {
        openPopup('profile-logout');
    });

    document.querySelector('#upload-photo')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('#upload-photo-tg').click();
    });

    document.querySelector('#upload-photo-tg')?.addEventListener('change', (e) => {
        e.target.form.submit();
    });

    const burger = document.querySelector('.burger');
    const sidebarButtons = document.querySelector('.sidebar-wrapper');

    burger.addEventListener('click', () => {
        sidebarButtons.classList.toggle('active');
    });

    const form = document.querySelector('.profile-form');

    if (form) {
        const inputs = form.querySelectorAll('input, textarea');
        const editBtn = document.querySelector('#edit-btn');
    
        const initialValues = {};
        inputs.forEach(input => {
            initialValues[input.name] = input.value;
        });
    
        const checkChanges = () => {
            let changed = false;
            inputs.forEach(input => {
                if (input.value !== initialValues[input.name]) {
                    changed = true;
                }
            });
    
            editBtn.style.display = changed ? 'inline-block' : 'none';
        };
    
        inputs.forEach(input => {
            input.addEventListener('input', checkChanges);
        });
    }


    document.querySelector('.item-inputs')?.addEventListener('click', function(e) {
        if (e.target.closest('button')) {
            e.preventDefault();

            const itemToDelete = e.target.closest('.item-input');
            if (itemToDelete) {
                itemToDelete.remove();
            }
        }
    });

    document.getElementById('add-item')?.addEventListener('click', (e) => {
        e.preventDefault();

        const container = document.querySelector('.item-inputs');
        const deleteIcon = container.getAttribute('data-delete-icon');

        const newItem = document.createElement('div');
        newItem.classList.add('item-input');
        newItem.innerHTML = `
            <input type="text" class="item-input-name" name="item_name[]" placeholder="Item name" required>
            <input type="number" class="item-input-price" min="1" step="any" name="item_price[]" placeholder="Amount" style="width: 100px;" required>
            <input type="number" class="item-input-qty" min="1" max="99" name="item_qty[]" placeholder="Quantity" style="width: 100px; margin-right: 50px" required>
            <button type="button"><img src="${deleteIcon}"></button>
        `;

        container.appendChild(newItem);
    });


    document.getElementById('invoice-statuses')?.addEventListener('change', function() {
        const status = this.value;

        fetch(`/invoices/filter?status=${encodeURIComponent(status)}`)
            .then(response => response.json())
            .then(data => {
                const container = document.querySelector('#invoices-tab .user_cards');

                container.innerHTML = ''; 

                if (data.length === 0) {
                    container.innerHTML = '<li style="color: var(--text-color-primary);font-family:K2D;">No invoices found</li>';
                    return;
                }

                data.forEach(inv => {
                    const li = document.createElement('li');
                    li.classList.add('user_item');
                    li.id = 'invoice-item';
                    
                    if (document.querySelector('.panel-admin')) {
                        console.log('admin');

                        li.innerHTML = `
                            <div class="user_item_single">
                                <div class="img-bg" style="background-color: ${inv.color};">
                                    <img src="/static/images/invoice.svg" width="48">
                                </div>
                                <h3>
                                    ${inv.title.length > 10 ? inv.title.slice(0, 10) + '..' : inv.title}
                                </h3>
                            </div>
                            <div class="status-btns">
                                ${inv.status === 'requested' ? `
                                    <div class="top_row">
                                        <button class="paid" data-invoice-id="${inv.id}" style="background-color: var(--button-success-color);">Paid</button>
                                        <button class="decline" data-invoice-id="${inv.id}" style="background-color: var(--button-close-color);">Decline</button>
                                    </div>
                                ` : ''}
                                <button class="details"
                                    data-name="${inv.title}"
                                    data-date="${inv.date_created}"
                                    data-status="${inv.status}"
                                    data-items='${JSON.stringify(inv.items_json)}'
                                    data-from="${inv.from || ''}"
                                    data-number="${inv.id}"
                                    data-note="${inv.note}"
                                    data-root="true">View details</button>
                            </div>
                        `;                        
                    } else {

                        console.log('not admin right now');

                        li.innerHTML = `
                            <div class="user_item_single">
                                <div class="img-bg" style="background-color: ${inv.color};">
                                    <img src="/static/images/invoice.svg" width="48">
                                </div>
                                <h3>${inv.title.length > 10 ? inv.title.slice(0, 10) + '...' : inv.title}</h3>
                                <span class="invoice-status">Status: ${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
                            </div>
                            <div class="status-btns">
                                <button class="details" style="width: 100%;" id="invoice-view-details"
                                data-name="${inv.title}"
                                data-date="${inv.date_created}"
                                data-status="${inv.status}"
                                data-items='${JSON.stringify(inv.items_json)}'
                                data-from="${inv.from || ''}"
                                data-number="${inv.id}"
                                data-note="${inv.note}">View details</button>
                                <button class="delete-invoice" data-invoice-id="${inv.id}" style="background-color: var(--button-close-color);width: 100%;">Delete</button>
                            </div>
                        `;
                    };

                    container.appendChild(li);
                });

                console.log(`All things added: ${container}`);

            })
            .catch(err => console.error(err));
    });

    const tabs = {
        users: document.getElementById('user-tab'),
        roles: document.getElementById('role-tab'),
        invoices: document.getElementById('invoices-tab'),
        statistics: document.getElementById('stat-tab')
    };

    const buttons = {
        users: document.querySelector('.panel-admin-users-btn'),
        roles: document.querySelector('.panel-admin-roles-btn'),
        invoices: document.querySelector('.panel-admin-invoices-btn'),
        statistics: document.querySelector('.panel-admin-stat-btn')
    };

    const addEntityBtn = document.getElementById('add-entity-btn');

    function showTab(tabName) {

        Object.entries(tabs).forEach(([name, el]) => {
        el.style.display = name === tabName ? 'flex' : 'none';
        });

        Object.entries(buttons).forEach(([name, btn]) => {
        btn.classList.toggle('active', name === tabName);
        });

        if (tabName === 'users') {
            addEntityBtn.textContent = 'Add user';
            addEntityBtn.style.display = 'inline-block';
            addEntityBtn.setAttribute("data-type", "users");

        } else if (tabName === 'roles') {
            addEntityBtn.textContent = 'Add role';
            addEntityBtn.style.display = 'inline-block';
            addEntityBtn.setAttribute("data-type", "role");

        } else {
            addEntityBtn.removeAttribute("data-type");
            addEntityBtn.style.display = 'none';
        }
    }

    document.querySelector('.panel-admin-users-btn')?.addEventListener('click', () => showTab('users'));
    document.querySelector('.panel-admin-roles-btn')?.addEventListener('click', () => showTab('roles'));
    document.querySelector('.panel-admin-invoices-btn')?.addEventListener('click', () => showTab('invoices'));
    document.querySelector('.panel-admin-stat-btn')?.addEventListener('click', () => showTab('statistics'));

    // listeners for the statistic tab
    document.querySelector('#stat-team')?.addEventListener('click', () => showTab('users'));
    document.querySelector('#stat-invoices')?.addEventListener('click', () => showTab('invoices'));
    document.querySelector('#stat-roles')?.addEventListener('click', () => showTab('roles'));

    showTab('users');
});

document.addEventListener('mousemove', (e) => {
    const layers = document.querySelectorAll('.parallax');
    const x = (e.clientX - window.innerWidth / 2) / 100;
    const y = (e.clientY - window.innerHeight / 2) / 175;

    layers.forEach((layer, index) => {
        const depth = (index + 1) * 1.01;
        layer.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
    });
});