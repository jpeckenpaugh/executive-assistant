import { completeJson } from './cloud-client.js';

const SCHEMAS = {
  tasks: `{ title (required string), description (string), priority ('low'|'medium'|'high'), due_at (ISO datetime string e.g. YYYY-MM-DDTHH:mm), recurrence ('none'|'daily'|'weekly'|'monthly') }`,
  commitments: `{ title (required string), kind ('meeting'|'other'), starts_at (ISO datetime string), duration_minutes (number), location (string), attendees (string), notes (string) }`,
  contacts: `{ name (required string), email (string), phone (string), organization (string), role (string), relationship_context (string) }`,
  notes: `{ title (string), content (required string), kind ('general'|'preparation'|'follow_up') }`,
  reminders: `{ title (required string), remind_at (ISO datetime string) }`,
  inbox_items: `{ content (required string) }`
};

export async function generateBulkItems(type, prompt, count) {
  const schema = SCHEMAS[type];
  if (!schema) {
    throw new Error(`Unsupported entity type: ${type}`);
  }

  const systemInstruction = `You are a data generation assistant. Generate a JSON object containing an "items" key with an array of exactly ${count} realistic items matching this entity schema for "${type}":
${schema}
Ensure all required fields are present and correctly formatted. Return ONLY valid JSON.`;

  const userPrompt = prompt || `Generate ${count} realistic sample ${type}`;
  const response = await completeJson({
    prompt: userPrompt,
    systemInstruction
  });

  if (!response || !Array.isArray(response.items)) {
    throw new Error('Invalid response from AI: expected an object with an "items" array.');
  }

  return response.items;
}

export function showGeneratorModal(type, onComplete) {
  let modalEl = document.getElementById('ai-generator-modal');
  if (modalEl) {
    modalEl.remove();
  }

  const defaultPrompt = `Generate 10 realistic sample ${type}`;
  modalEl = document.createElement('div');
  modalEl.id = 'ai-generator-modal';
  modalEl.className = 'modal fade show';
  modalEl.style.display = 'block';
  modalEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalEl.setAttribute('tabindex', '-1');
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');

  modalEl.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">✨ AI Generator (${type})</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="ai-generator-form" class="row g-3 mb-3">
            <div class="col-md-8">
              <label for="ai-prompt-input" class="form-label">Prompt / Description</label>
              <input type="text" id="ai-prompt-input" class="form-control" value="${defaultPrompt}">
            </div>
            <div class="col-md-4">
              <label for="ai-count-input" class="form-label">Count (1-20)</label>
              <input type="number" id="ai-count-input" class="form-control" value="10" min="1" max="20">
            </div>
            <div class="col-12">
              <button type="submit" class="btn btn-primary" id="ai-generate-btn">Generate</button>
            </div>
          </form>
          <div id="ai-generator-status" class="alert alert-info d-none">Generating candidate records...</div>
          <div id="ai-generator-preview" class="border rounded p-3 d-none" style="max-height: 300px; overflow-y: auto;">
            <h6>Generated Candidates (<span id="ai-checked-count">0</span> selected)</h6>
            <div id="ai-preview-list"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-success d-none" id="ai-save-btn">Save to Workspace</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  const closeModal = () => {
    modalEl.remove();
  };

  modalEl.querySelectorAll('[data-bs-dismiss="modal"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  const form = modalEl.querySelector('#ai-generator-form');
  const promptInput = modalEl.querySelector('#ai-prompt-input');
  const countInput = modalEl.querySelector('#ai-count-input');
  const generateBtn = modalEl.querySelector('#ai-generate-btn');
  const statusEl = modalEl.querySelector('#ai-generator-status');
  const previewEl = modalEl.querySelector('#ai-generator-preview');
  const previewList = modalEl.querySelector('#ai-preview-list');
  const checkedCountEl = modalEl.querySelector('#ai-checked-count');
  const saveBtn = modalEl.querySelector('#ai-save-btn');

  let candidateItems = [];

  const updateCheckedCount = () => {
    const checked = previewList.querySelectorAll('.ai-item-checkbox:checked').length;
    checkedCountEl.textContent = checked;
    saveBtn.disabled = checked === 0;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const promptVal = promptInput.value.trim();
    const countVal = Math.min(20, Math.max(1, parseInt(countInput.value, 10) || 10));

    statusEl.className = 'alert alert-info';
    statusEl.textContent = 'Generating candidate records with AI...';
    statusEl.classList.remove('d-none');
    previewEl.classList.add('d-none');
    saveBtn.classList.add('d-none');
    generateBtn.disabled = true;

    try {
      candidateItems = await generateBulkItems(type, promptVal, countVal);
      statusEl.classList.add('d-none');
      previewList.innerHTML = candidateItems.map((item, idx) => {
        const title = item.title || item.name || item.content || `Item ${idx + 1}`;
        const detailStr = JSON.stringify(item);
        return `
          <div class="form-check border-bottom py-2">
            <input class="form-check-input ai-item-checkbox" type="checkbox" id="ai-candidate-${idx}" data-index="${idx}" checked>
            <label class="form-check-label w-100" for="ai-candidate-${idx}">
              <strong>${title}</strong>
              <div class="text-muted small">${detailStr}</div>
            </label>
          </div>
        `;
      }).join('');

      previewEl.classList.remove('d-none');
      saveBtn.classList.remove('d-none');
      updateCheckedCount();

      previewList.querySelectorAll('.ai-item-checkbox').forEach(cb => {
        cb.addEventListener('change', updateCheckedCount);
      });
    } catch (err) {
      statusEl.className = 'alert alert-danger';
      statusEl.textContent = `Generation failed: ${err.message}`;
    } finally {
      generateBtn.disabled = false;
    }
  });

  saveBtn.addEventListener('click', async () => {
    const selectedIndices = Array.from(previewList.querySelectorAll('.ai-item-checkbox:checked'))
      .map(cb => parseInt(cb.dataset.index, 10));

    if (selectedIndices.length === 0) return;

    saveBtn.disabled = true;
    statusEl.className = 'alert alert-info';
    statusEl.textContent = `Saving ${selectedIndices.length} item(s) to workspace...`;
    statusEl.classList.remove('d-none');

    try {
      const { save } = await import('../api.js');
      let savedCount = 0;
      for (const idx of selectedIndices) {
        const item = candidateItems[idx];
        await save(type, null, item);
        savedCount++;
      }
      closeModal();
      if (typeof onComplete === 'function') {
        onComplete(savedCount);
      }
    } catch (err) {
      statusEl.className = 'alert alert-danger';
      statusEl.textContent = `Saving failed: ${err.message}`;
      saveBtn.disabled = false;
    }
  });
}
