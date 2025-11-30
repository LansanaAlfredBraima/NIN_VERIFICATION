// Admin Panel JavaScript with Camera Capture and ID Card Generation

let stream = null;
let capturedPhotoData = null;

function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateTime, 1000);
updateTime();

// Camera Functions
document.getElementById('startCamera').addEventListener('click', async () => {
    try {
        // Request laptop camera specifically (not phone)
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',  // Front-facing camera (laptop camera)
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        const video = document.getElementById('camera');
        video.srcObject = stream;
        video.style.display = 'block';
        document.getElementById('cameraPlaceholder').style.display = 'none';
        document.getElementById('startCamera').style.display = 'none';
        document.getElementById('captureBtn').style.display = 'inline-block';
    } catch (err) {
        alert('Camera access denied or not available. Please ensure your laptop camera is connected and permissions are granted.');
        console.error(err);
    }
});

document.getElementById('captureBtn').addEventListener('click', () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    capturedPhotoData = canvas.toDataURL('image/jpeg');
    document.getElementById('photoData').value = capturedPhotoData;

    const img = document.getElementById('capturedPhoto');
    img.src = capturedPhotoData;
    img.style.display = 'block';
    video.style.display = 'none';

    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('retakeBtn').style.display = 'inline-block';
    document.getElementById('submitBtn').disabled = false;

    // Stop camera
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});

document.getElementById('retakeBtn').addEventListener('click', () => {
    document.getElementById('capturedPhoto').style.display = 'none';
    document.getElementById('retakeBtn').style.display = 'none';
    document.getElementById('startCamera').style.display = 'inline-block';
    document.getElementById('submitBtn').disabled = true;
    capturedPhotoData = null;
});

// Load Functions
async function loadUsers() {
    const res = await fetch('/admin/users');
    const users = await res.json();
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td><i class="fas fa-user me-2"></i>${u.username}</td>
            <td><span class="badge bg-primary">${u.role.replace('_', ' ').toUpperCase()}</span></td>
            <td>${u.organization}</td>
            <td><span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Active</span></td>
        </tr>
    `).join('');
    document.getElementById('totalUsers').textContent = users.length;
}

async function loadNINRecords() {
    const res = await fetch('/admin/nin-records');
    const records = await res.json();
    const tbody = document.getElementById('ninRecordsTableBody');
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No records found</td></tr>';
    } else {
        tbody.innerHTML = records.map(r => `
            <tr>
                <td><img src="${r.photo_url}" class="rounded-circle" width="40" height="40" style="object-fit: cover;"></td>
                <td><strong>${r.nin}</strong></td>
                <td>${r.first_name} ${r.last_name}</td>
                <td>${r.dob}</td>
                <td>${r.gender}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="editCitizen('${r.nin}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success me-1" onclick="generateIDCardFor('${r.nin}')" title="Generate ID Card">
                        <i class="fas fa-id-card"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCitizen('${r.nin}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    document.getElementById('totalNINs').textContent = records.length;
}

// Delete Citizen Function
window.deleteCitizen = async (nin) => {
    if (confirm(`Are you sure you want to DELETE the citizen with NIN: ${nin}? This action cannot be undone.`)) {
        const res = await fetch(`/admin/delete-citizen/${nin}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert('Citizen deleted successfully');
            loadNINRecords();
        } else {
            alert('Error deleting citizen');
        }
    }
};

// Edit Citizen Functions
let editStream = null;
let editCapturedPhotoData = null;

window.editCitizen = async (nin) => {
    const res = await fetch(`/verify/${nin}`);
    const data = await res.json();

    if (data.success) {
        const citizen = data.data;
        document.getElementById('editNin').value = citizen.nin;
        document.getElementById('editLastName').value = citizen.last_name;
        document.getElementById('editFirstName').value = citizen.first_name;
        document.getElementById('editMiddleName').value = citizen.middle_name || '';
        document.getElementById('editDob').value = citizen.dob;
        document.getElementById('editGender').value = citizen.gender;
        document.getElementById('editHeight').value = citizen.height || '';
        document.getElementById('editAddress').value = citizen.address;
        document.getElementById('editPhotoPreview').src = citizen.photo_url;
        document.getElementById('editPhotoData').value = citizen.photo_url;

        const modal = new bootstrap.Modal(document.getElementById('editCitizenModal'));
        modal.show();
    } else {
        alert('Error fetching citizen details');
    }
};

document.getElementById('editRetakePhotoBtn').addEventListener('click', async () => {
    try {
        editStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        const video = document.getElementById('editCamera');
        video.srcObject = editStream;
        document.getElementById('editCameraContainer').style.display = 'block';
        document.getElementById('editPhotoPreview').style.display = 'none';
        document.getElementById('editRetakePhotoBtn').style.display = 'none';
    } catch (err) {
        alert('Camera access denied');
    }
});

document.getElementById('editCaptureBtn').addEventListener('click', () => {
    const video = document.getElementById('editCamera');
    const canvas = document.getElementById('editCanvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    editCapturedPhotoData = canvas.toDataURL('image/jpeg');
    document.getElementById('editPhotoData').value = editCapturedPhotoData;
    document.getElementById('editPhotoPreview').src = editCapturedPhotoData;

    document.getElementById('editCameraContainer').style.display = 'none';
    document.getElementById('editPhotoPreview').style.display = 'block';
    document.getElementById('editRetakePhotoBtn').style.display = 'inline-block';

    if (editStream) {
        editStream.getTracks().forEach(track => track.stop());
    }
});

document.getElementById('editCitizenForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch('/admin/update-citizen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert('Citizen details updated successfully');
        bootstrap.Modal.getInstance(document.getElementById('editCitizenModal')).hide();
        loadNINRecords();
    } else {
        alert('Error updating citizen details');
    }
});

window.generateIDCardFor = async (nin) => {
    const res = await fetch(`/verify/${nin}`);
    const data = await res.json();

    if (data.success) {
        generateIDCard(data.data);
        // Switch to register tab to see the ID card
        const triggerEl = document.querySelector('#register-tab');
        const tab = new bootstrap.Tab(triggerEl);
        tab.show();
    }
};

async function loadLogs() {
    const res = await fetch('/admin/logs');
    const logs = await res.json();
    const tbody = document.getElementById('logsTableBody');
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No logs available</td></tr>';
    } else {
        tbody.innerHTML = logs.map(l => `
            <tr>
                <td><i class="fas fa-clock me-2"></i>${new Date(l.timestamp).toLocaleString()}</td>
                <td><i class="fas fa-user me-2"></i>${l.username}</td>
                <td><span class="badge bg-info">${l.action}</span></td>
                <td>${l.details}</td>
            </tr>
        `).join('');
    }
    document.getElementById('totalVerifications').textContent = logs.length;
}

// Add User
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert('User created successfully');
        location.reload();
    } else {
        alert('Error creating user');
    }
});

// Register Citizen with Auto-NIN and ID Card Generation
document.getElementById('registerCitizenForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!capturedPhotoData) {
        alert('Please capture a photo first');
        return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch('/admin/register-citizen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
        document.getElementById('registerSuccess').style.display = 'block';
        document.getElementById('registerError').style.display = 'none';

        // Generate ID Card
        generateIDCard(result.citizen);

        e.target.reset();
        loadNINRecords();

        // Reset camera
        document.getElementById('capturedPhoto').style.display = 'none';
        document.getElementById('cameraPlaceholder').style.display = 'block';
        document.getElementById('retakeBtn').style.display = 'none';
        document.getElementById('startCamera').style.display = 'inline-block';
        document.getElementById('submitBtn').disabled = true;
        capturedPhotoData = null;

        setTimeout(() => {
            document.getElementById('registerSuccess').style.display = 'none';
        }, 3000);
    } else {
        document.getElementById('registerError').style.display = 'block';
        document.getElementById('registerErrorMsg').textContent = result.error || 'Registration failed';
        document.getElementById('registerSuccess').style.display = 'none';
    }
});

// Generate Sierra Leone ID Card
function generateIDCard(citizen) {
    const container = document.getElementById('idCardContainer');

    const idCard = `
        <div id="sierraLeoneIDCard" style="width: 856px; height: 540px; background: linear-gradient(135deg, #e8f5e9 0%, #fff9c4 50%, #e1f5fe 100%); position: relative; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); margin: 0 auto; font-family: Arial, sans-serif; overflow: hidden;">
            
            <!-- Background Pattern -->
            <div style="position: absolute; width: 100%; height: 100%; opacity: 0.1;">
                <div style="position: absolute; width: 200px; height: 200px; border: 2px solid #4caf50; border-radius: 50%; top: 50px; left: -50px;"></div>
                <div style="position: absolute; width: 150px; height: 150px; border: 2px solid #4caf50; border-radius: 50%; top: 100px; left: 50px;"></div>
                <div style="position: absolute; width: 180px; height: 180px; border: 2px solid #2196f3; border-radius: 50%; bottom: 50px; right: -40px;"></div>
                <div style="position: absolute; width: 120px; height: 120px; border: 2px solid #2196f3; border-radius: 50%; bottom: 80px; right: 80px;"></div>
            </div>
            
            <!-- Flag -->
            <div style="position: absolute; top: 20px; left: 30px; width: 120px; height: 80px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                <div style="height: 33.33%; background: #1eb53a;"></div>
                <div style="height: 33.33%; background: white;"></div>
                <div style="height: 33.33%; background: #0072c6;"></div>
            </div>
            
            <!-- Header -->
            <div style="position: absolute; top: 15px; left: 170px; right: 150px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #333; letter-spacing: 1px;">REPUBLIC OF SIERRA LEONE</div>
                <div style="background: linear-gradient(90deg, #1eb53a 0%, #1eb53a 100%); color: white; padding: 5px; font-size: 16px; font-weight: bold; margin-top: 5px; letter-spacing: 2px;">NATIONAL IDENTITY CARD</div>
            </div>
            
            <!-- Coat of Arms -->
            <div style="position: absolute; top: 15px; right: 30px; width: 100px; height: 100px; background: rgba(255,255,255,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                <div style="font-size: 60px;">🦁</div>
            </div>
            
            <!-- Photo -->
            <div style="position: absolute; top: 140px; left: 40px; width: 200px; height: 240px; border: 3px solid #1eb53a; background: white; overflow: hidden;">
                <img src="${citizen.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            
            <!-- SLE Watermark -->
            <div style="position: absolute; top: 150px; left: 260px; font-size: 80px; font-weight: bold; color: rgba(30, 181, 58, 0.1); transform: rotate(-10deg); letter-spacing: 5px;">SLE</div>
            
            <!-- Citizen Details -->
            <div style="position: absolute; top: 140px; left: 260px; right: 40px;">
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Surname</div>
                    <div style="font-size: 18px; font-weight: bold; color: #333;">${citizen.last_name.toUpperCase()}</div>
                </div>
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Name</div>
                    <div style="font-size: 18px; font-weight: bold; color: #333;">${citizen.first_name.toUpperCase()}</div>
                </div>
                ${citizen.middle_name ? `
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Middle Name</div>
                    <div style="font-size: 18px; font-weight: bold; color: #333;">${citizen.middle_name.toUpperCase()}</div>
                </div>
                ` : ''}
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Sex</div>
                    <div style="font-size: 18px; font-weight: bold; color: #333;">${citizen.gender}</div>
                </div>
                ${citizen.height ? `
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Height (m)</div>
                    <div style="font-size: 18px; font-weight: bold; color: #333;">${citizen.height}</div>
                </div>
                ` : ''}
            </div>
            
            <!-- Right Side Info -->
            <div style="position: absolute; top: 140px; right: 40px; text-align: right;">
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Date of Birth</div>
                    <div style="font-size: 16px; font-weight: bold; color: #333;">${citizen.dob}</div>
                </div>
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Personal ID Number</div>
                    <div style="font-size: 14px; font-weight: bold; color: #333; background: rgba(255,255,255,0.7); padding: 5px; border-radius: 5px;">${citizen.nin}</div>
                </div>
                ${citizen.expiry_date ? `
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Date of Expiry</div>
                    <div style="font-size: 14px; font-weight: bold; color: #333;">${citizen.expiry_date}</div>
                </div>
                ` : ''}
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 2px;">NIN</div>
                    <div style="font-size: 20px; font-weight: bold; color: #1eb53a; letter-spacing: 2px;">${citizen.nin}</div>
                </div>
            </div>
            
            <!-- Fingerprint -->
            <div style="position: absolute; bottom: 40px; right: 40px; width: 100px; height: 100px; background: rgba(30, 181, 58, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <div style="width: 70px; height: 70px; background: radial-gradient(circle, transparent 30%, #1eb53a 30%, #1eb53a 35%, transparent 35%, transparent 40%, #1eb53a 40%, #1eb53a 45%, transparent 45%); border-radius: 50%;"></div>
            </div>
            
            <!-- Security Icon -->
            <div style="position: absolute; bottom: 40px; right: 160px; font-size: 40px; color: #0072c6; opacity: 0.7;">🔒</div>
        </div>
    `;

    container.innerHTML = idCard;
    document.getElementById('idCardPreview').style.display = 'block';

    // Scroll to ID card
    document.getElementById('idCardPreview').scrollIntoView({ behavior: 'smooth' });
}

// Download ID Card
document.getElementById('downloadIdCard').addEventListener('click', () => {
    const idCard = document.getElementById('sierraLeoneIDCard');

    html2canvas(idCard, {
        scale: 2,
        backgroundColor: null
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'sierra_leone_id_card.png';
        link.href = canvas.toDataURL();
        link.click();
    });
});

// Initial Load
loadUsers();
loadNINRecords();
loadLogs();

// Check auth
fetch('/check-auth')
    .then(res => res.json())
    .then(data => {
        if (!data.authenticated || (data.role !== 'super_admin' && data.role !== 'ncra_admin')) {
            window.location.href = '/index.html';
        }
    });
