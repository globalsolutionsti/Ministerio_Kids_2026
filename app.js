const state = {
  apiUrl: (window.APP_CONFIG && window.APP_CONFIG.API_URL ? window.APP_CONFIG.API_URL : '').trim(),
  token: localStorage.getItem('kids_token') || '',
  user: JSON.parse(localStorage.getItem('kids_user') || 'null'),
  editingId: null,
  records: [],
  filteredRecords: [],
  kidPhotoPayload: null,
  kidPhotoMeta: null,
  removeKidPhoto: false
};

const elements = {};

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  cacheElements();
  bindEvents();
  resetForm();

  if (!state.apiUrl || state.apiUrl.includes('PEGAR_AQUI')) {
    showMessage(elements.loginMessage, 'Configura primero el archivo config.js con la URL de Apps Script.', 'error');
  }

  if (state.token && state.user) {
    openDashboard();
    loadRecords();
  }
}

function cacheElements() {
  elements.loginScreen = document.getElementById('loginScreen');
  elements.dashboard = document.getElementById('dashboard');
  elements.loginForm = document.getElementById('loginForm');
  elements.loginUsername = document.getElementById('loginUsername');
  elements.loginPassword = document.getElementById('loginPassword');
  elements.loginMessage = document.getElementById('loginMessage');
  elements.sessionUser = document.getElementById('sessionUser');
  elements.logoutButton = document.getElementById('logoutButton');
  elements.searchInput = document.getElementById('searchInput');
  elements.refreshButton = document.getElementById('refreshButton');
  elements.newRecordButton = document.getElementById('newRecordButton');
  elements.recordsList = document.getElementById('recordsList');
  elements.recordCounter = document.getElementById('recordCounter');
  elements.formTitle = document.getElementById('formTitle');
  elements.kidForm = document.getElementById('kidForm');
  elements.kidFullName = document.getElementById('kidFullName');
  elements.kidGroupName = document.getElementById('kidGroupName');
  elements.kidBirthDate = document.getElementById('kidBirthDate');
  elements.kidGender = document.getElementById('kidGender');
  elements.kidAllergies = document.getElementById('kidAllergies');
  elements.kidNotes = document.getElementById('kidNotes');
  elements.kidPhotoInput = document.getElementById('kidPhotoInput');
  elements.kidPhotoPreview = document.getElementById('kidPhotoPreview');
  elements.removeKidPhotoButton = document.getElementById('removeKidPhotoButton');
  elements.addGuardianButton = document.getElementById('addGuardianButton');
  elements.guardiansContainer = document.getElementById('guardiansContainer');
  elements.resetFormButton = document.getElementById('resetFormButton');
  elements.formMessage = document.getElementById('formMessage');
  elements.saveButton = document.getElementById('saveButton');
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.refreshButton.addEventListener('click', loadRecords);
  elements.newRecordButton.addEventListener('click', resetForm);
  elements.searchInput.addEventListener('input', applyFilter);
  elements.kidForm.addEventListener('submit', handleSaveRecord);
  elements.kidPhotoInput.addEventListener('change', handleKidPhotoChange);
  elements.removeKidPhotoButton.addEventListener('click', removeKidPhoto);
  elements.addGuardianButton.addEventListener('click', () => addGuardianCard());
  elements.resetFormButton.addEventListener('click', resetForm);
}

async function handleLogin(event) {
  event.preventDefault();
  clearMessage(elements.loginMessage);

  if (!state.apiUrl || state.apiUrl.includes('PEGAR_AQUI')) {
    showMessage(elements.loginMessage, 'Debes configurar la URL del backend en frontend/config.js.', 'error');
    return;
  }

  try {
    setLoading(elements.loginForm, true);
    const response = await apiRequest({
      action: 'login',
      username: elements.loginUsername.value.trim(),
      password: elements.loginPassword.value
    });

    state.token = response.token;
    state.user = response.user;
    localStorage.setItem('kids_token', state.token);
    localStorage.setItem('kids_user', JSON.stringify(state.user));

    openDashboard();
    await loadRecords();
    showMessage(elements.formMessage, 'Sesión iniciada correctamente.', 'success');
  } catch (error) {
    showMessage(elements.loginMessage, error.message, 'error');
  } finally {
    setLoading(elements.loginForm, false);
  }
}

async function handleLogout() {
  try {
    if (state.token) {
      await apiRequest({
        action: 'logout',
        token: state.token
      });
    }
  } catch (error) {
  }

  state.token = '';
  state.user = null;
  state.records = [];
  state.filteredRecords = [];
  localStorage.removeItem('kids_token');
  localStorage.removeItem('kids_user');
  elements.dashboard.classList.add('hidden');
  elements.loginScreen.classList.remove('hidden');
  showMessage(elements.loginMessage, 'Sesión cerrada.', 'success');
}

function openDashboard() {
  elements.loginScreen.classList.add('hidden');
  elements.dashboard.classList.remove('hidden');
  elements.sessionUser.textContent = state.user && state.user.displayName
    ? state.user.displayName
    : 'Administrador';
}

async function loadRecords() {
  clearMessage(elements.formMessage);
  try {
    const response = await apiRequest({
      action: 'listKids',
      token: state.token
    });

    state.records = Array.isArray(response.data) ? response.data : [];
    applyFilter();
  } catch (error) {
    handleSessionError(error);
  }
}

function applyFilter() {
  const term = elements.searchInput.value.trim().toLowerCase();
  state.filteredRecords = !term
    ? [...state.records]
    : state.records.filter(record => {
        const text = [
          record.fullName,
          record.groupName,
          record.guardianNames.join(' ')
        ].join(' ').toLowerCase();
        return text.includes(term);
      });

  renderRecords();
}

function renderRecords() {
  elements.recordCounter.textContent = String(state.filteredRecords.length);

  if (!state.filteredRecords.length) {
    elements.recordsList.innerHTML = `
      <div class="record-empty">
        No hay registros para mostrar. Usa "Nuevo registro" para comenzar.
      </div>
    `;
    return;
  }

  elements.recordsList.innerHTML = state.filteredRecords.map(record => `
    <article class="record-card">
      <div>
        <div class="record-badge">${escapeHtml(record.groupName || 'Sin grupo')}</div>
        <h5>${escapeHtml(record.fullName)}</h5>
        <p>${record.guardianCount} responsable(s) autorizado(s)</p>
      </div>
      <div class="record-meta">
        <span>Responsables: ${escapeHtml(record.guardianNames.join(', ') || 'Sin responsables')}</span>
      </div>
      <div class="record-footer">
        <small>Actualizado: ${formatDateTime(record.updatedAt)}</small>
        <div class="record-actions">
          <button type="button" class="ghost-button" data-action="edit" data-id="${record.id}">Editar</button>
          <button type="button" class="danger-button" data-action="delete" data-id="${record.id}">Eliminar</button>
        </div>
      </div>
    </article>
  `).join('');

  elements.recordsList.querySelectorAll('[data-action="edit"]').forEach(button => {
    button.addEventListener('click', () => editRecord(button.dataset.id));
  });

  elements.recordsList.querySelectorAll('[data-action="delete"]').forEach(button => {
    button.addEventListener('click', () => deleteRecord(button.dataset.id));
  });
}

async function editRecord(id) {
  clearMessage(elements.formMessage);

  try {
    const response = await apiRequest({
      action: 'getKid',
      token: state.token,
      id
    });

    fillForm(response.data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    handleSessionError(error);
  }
}

async function deleteRecord(id) {
  const record = state.records.find(item => item.id === id);
  if (!record) {
    return;
  }

  const confirmed = window.confirm(`¿Deseas eliminar el registro de ${record.fullName}?`);
  if (!confirmed) {
    return;
  }

  try {
    const response = await apiRequest({
      action: 'deleteKid',
      token: state.token,
      id
    });

    showMessage(elements.formMessage, response.message, 'success');
    if (state.editingId === id) {
      resetForm();
    }
    await loadRecords();
  } catch (error) {
    handleSessionError(error);
  }
}

async function handleSaveRecord(event) {
  event.preventDefault();
  clearMessage(elements.formMessage);

  try {
    setButtonLoading(elements.saveButton, true, 'Guardando...');
    const payload = collectFormData();
    const action = state.editingId ? 'updateKid' : 'createKid';
    const request = {
      action,
      token: state.token,
      data: payload
    };

    if (state.editingId) {
      request.id = state.editingId;
    }

    const response = await apiRequest(request);
    showMessage(elements.formMessage, response.message, 'success');
    resetForm();
    await loadRecords();
  } catch (error) {
    handleSessionError(error);
  } finally {
    setButtonLoading(elements.saveButton, false, 'Guardar registro');
  }
}

function collectFormData() {
  const guardians = Array.from(elements.guardiansContainer.querySelectorAll('.guardian-card')).map(card => {
    const photoPayload = card._photoPayload || null;
    return {
      id: card.dataset.guardianId || '',
      fullName: card.querySelector('[data-field="fullName"]').value.trim(),
      relationship: card.querySelector('[data-field="relationship"]').value.trim(),
      phone: card.querySelector('[data-field="phone"]').value.trim(),
      identification: card.querySelector('[data-field="identification"]').value.trim(),
      notes: card.querySelector('[data-field="notes"]').value.trim(),
      photo: photoPayload && photoPayload.base64 ? photoPayload : null,
      removePhoto: card._removePhoto === true
    };
  }).filter(guardian => guardian.fullName);

  return {
    fullName: elements.kidFullName.value.trim(),
    groupName: elements.kidGroupName.value.trim(),
    birthDate: elements.kidBirthDate.value,
    gender: elements.kidGender.value,
    allergies: elements.kidAllergies.value.trim(),
    notes: elements.kidNotes.value.trim(),
    kidPhoto: state.kidPhotoPayload && state.kidPhotoPayload.base64 ? state.kidPhotoPayload : null,
    removeKidPhoto: state.removeKidPhoto,
    guardians
  };
}

function fillForm(record) {
  state.editingId = record.id;
  elements.formTitle.textContent = `Editando: ${record.fullName}`;
  elements.kidFullName.value = record.fullName || '';
  elements.kidGroupName.value = record.groupName || '';
  elements.kidBirthDate.value = record.birthDate || '';
  elements.kidGender.value = record.gender || '';
  elements.kidAllergies.value = record.allergies || '';
  elements.kidNotes.value = record.notes || '';
  state.kidPhotoPayload = null;
  state.kidPhotoMeta = record.kidPhoto || null;
  state.removeKidPhoto = false;
  elements.kidPhotoInput.value = '';
  renderKidPhotoPreview(record.kidPhoto ? record.kidPhoto.previewUrl : '');

  elements.guardiansContainer.innerHTML = '';
  (record.guardians || []).forEach(guardian => addGuardianCard(guardian));

  if (!record.guardians || !record.guardians.length) {
    addGuardianCard();
  }
}

function resetForm() {
  state.editingId = null;
  state.kidPhotoPayload = null;
  state.kidPhotoMeta = null;
  state.removeKidPhoto = false;
  elements.formTitle.textContent = 'Nuevo registro';
  elements.kidForm.reset();
  elements.kidPhotoInput.value = '';
  renderKidPhotoPreview('');
  elements.guardiansContainer.innerHTML = '';
  addGuardianCard();
  clearMessage(elements.formMessage);
}

function addGuardianCard(data = {}) {
  const card = document.createElement('article');
  card.className = 'guardian-card';
  card.dataset.guardianId = data.id || '';
  card._photoPayload = null;
  card._removePhoto = false;

  const previewUrl = data.photo && data.photo.previewUrl ? data.photo.previewUrl : '';

  card.innerHTML = `
    <div class="guardian-header">
      <div>
        <div class="guardian-title">Responsable</div>
        <p class="panel-text">Adulto autorizado para recoger al niño.</p>
      </div>
      <button type="button" class="danger-button" data-role="remove-guardian">Quitar</button>
    </div>
    <div class="form-grid">
      <label class="inline-field inline-field-wide">
        <span>Nombre completo *</span>
        <input type="text" data-field="fullName" value="${escapeHtml(data.fullName || '')}" required>
      </label>
      <label class="inline-field">
        <span>Parentesco *</span>
        <input type="text" data-field="relationship" value="${escapeHtml(data.relationship || '')}" placeholder="Ej. Mamá" required>
      </label>
      <label class="inline-field">
        <span>Teléfono</span>
        <input type="tel" data-field="phone" value="${escapeHtml(data.phone || '')}" placeholder="Ej. 5512345678">
      </label>
      <label class="inline-field">
        <span>Identificación</span>
        <input type="text" data-field="identification" value="${escapeHtml(data.identification || '')}" placeholder="INE / Pasaporte">
      </label>
      <label class="inline-field inline-field-wide">
        <span>Notas</span>
        <textarea data-field="notes" rows="2">${escapeHtml(data.notes || '')}</textarea>
      </label>
    </div>
    <div class="photo-card">
      <div>
        <h6>Foto del responsable</h6>
        <p>Desde el celular puedes tomar la foto en el momento.</p>
      </div>
      <div class="photo-actions">
        <input type="file" accept="image/*" capture="environment" data-role="guardian-photo-input">
        <button type="button" class="ghost-button" data-role="remove-guardian-photo">Quitar foto</button>
      </div>
      <div class="photo-preview-wrapper">
        <img class="photo-preview ${previewUrl ? '' : 'hidden'}" data-role="guardian-photo-preview" alt="Vista previa del responsable" src="${previewUrl}">
      </div>
    </div>
  `;

  const removeButton = card.querySelector('[data-role="remove-guardian"]');
  const photoInput = card.querySelector('[data-role="guardian-photo-input"]');
  const preview = card.querySelector('[data-role="guardian-photo-preview"]');
  const removePhotoButton = card.querySelector('[data-role="remove-guardian-photo"]');

  removeButton.addEventListener('click', () => {
    const totalCards = elements.guardiansContainer.querySelectorAll('.guardian-card').length;
    if (totalCards === 1) {
      showMessage(elements.formMessage, 'Debe existir al menos un responsable.', 'error');
      return;
    }
    card.remove();
  });

  photoInput.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      const photoPayload = await optimizeImage(file, 'responsable');
      card._photoPayload = photoPayload;
      card._removePhoto = false;
      preview.src = photoPayload.previewUrl;
      preview.classList.remove('hidden');
    } catch (error) {
      showMessage(elements.formMessage, 'No se pudo procesar la foto del responsable.', 'error');
    }
  });

  removePhotoButton.addEventListener('click', () => {
    photoInput.value = '';
    card._photoPayload = null;
    card._removePhoto = true;
    preview.src = '';
    preview.classList.add('hidden');
  });

  elements.guardiansContainer.appendChild(card);
}

async function handleKidPhotoChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const photoPayload = await optimizeImage(file, 'nino');
    state.kidPhotoPayload = photoPayload;
    state.kidPhotoMeta = null;
    state.removeKidPhoto = false;
    renderKidPhotoPreview(photoPayload.previewUrl);
  } catch (error) {
    showMessage(elements.formMessage, 'No se pudo procesar la foto del niño.', 'error');
  }
}

function removeKidPhoto() {
  state.kidPhotoPayload = null;
  state.kidPhotoMeta = null;
  state.removeKidPhoto = true;
  elements.kidPhotoInput.value = '';
  renderKidPhotoPreview('');
}

function renderKidPhotoPreview(src) {
  if (src) {
    elements.kidPhotoPreview.src = src;
    elements.kidPhotoPreview.classList.remove('hidden');
  } else {
    elements.kidPhotoPreview.src = '';
    elements.kidPhotoPreview.classList.add('hidden');
  }
}

async function apiRequest(payload) {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));

  const response = await fetch(state.apiUrl, {
    method: 'POST',
    body: formData,
    redirect: 'follow'
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.message || 'No se pudo completar la solicitud.');
  }

  return data;
}

async function optimizeImage(file, baseName) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const maxSize = 1400;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  const previewUrl = canvas.toDataURL('image/jpeg', 0.84);

  return {
    fileName: `${baseName}_${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    base64: previewUrl.split(',')[1],
    previewUrl
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    image.src = src;
  });
}

function showMessage(target, message, type) {
  target.textContent = message || '';
  target.classList.remove('error', 'success');
  if (type) {
    target.classList.add(type);
  }
}

function clearMessage(target) {
  showMessage(target, '', '');
}

function setLoading(form, isLoading) {
  form.querySelectorAll('button, input').forEach(element => {
    element.disabled = isLoading;
  });
}

function setButtonLoading(button, isLoading, loadingText) {
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || 'Guardar registro';
    button.disabled = false;
  }
}

function handleSessionError(error) {
  if (String(error.message || '').toLowerCase().includes('sesion')) {
    handleLogout();
  }
  showMessage(elements.formMessage, error.message || 'Ocurrió un error.', 'error');
}

function formatDateTime(value) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
