import { completeJson } from './cloud-client.js';
import { save } from '../api.js';

const TYPE_MAP = {
  task: 'tasks',
  tasks: 'tasks',
  commitment: 'commitments',
  commitments: 'commitments',
  contact: 'contacts',
  contacts: 'contacts',
  note: 'notes',
  notes: 'notes',
  reminder: 'reminders',
  reminders: 'reminders',
  inbox_items: 'inbox_items',
  inbox_item: 'inbox_items',
  inbox: 'inbox_items'
};

const SINGULAR_LABELS = {
  tasks: 'Task',
  task: 'Task',
  commitments: 'Commitment',
  commitment: 'Commitment',
  contacts: 'Contact',
  contact: 'Contact',
  notes: 'Note',
  note: 'Note',
  reminders: 'Reminder',
  reminder: 'Reminder',
  inbox_items: 'Inbox Item',
  inbox_item: 'Inbox Item',
  inbox: 'Inbox Item'
};

export async function processCommand(userPrompt) {
  if (!userPrompt || !userPrompt.trim()) {
    throw new Error('Command prompt cannot be empty.');
  }

  const nowString = new Date().toString();
  const systemInstruction = `You are an AI natural language command agent for an executive assistant application.
The current local time is: ${nowString}.

Convert the user's intent into a JSON object containing an "actions" array of one or more proposed database creation actions.
Supported action types and their data schemas:
- "task": { "title": string (required), "description": string, "priority": "low"|"medium"|"high", "due_at": "YYYY-MM-DDTHH:mm" (ISO datetime), "recurrence": "none"|"daily"|"weekly"|"monthly" }
- "commitment": { "title": string (required), "kind": "meeting"|"other", "starts_at": "YYYY-MM-DDTHH:mm" (ISO datetime, required), "duration_minutes": number, "location": string, "attendees": string, "notes": string }
- "contact": { "name": string (required), "email": string, "phone": string, "organization": string, "role": string, "relationship_context": string }
- "note": { "content": string (required), "title": string, "kind": "general"|"preparation"|"follow_up" }
- "reminder": { "title": string (required), "remind_at": "YYYY-MM-DDTHH:mm" (ISO datetime, required) }
- "inbox_items": { "content": string (required) }

Rules:
1. Convert all relative dates and times (e.g. "tomorrow 2pm", "next Friday 9am", "in 3 hours") into exact datetimes in YYYY-MM-DDTHH:mm format based on the provided current local time.
2. A single user prompt may contain multiple instructions or actions (e.g. "Schedule meeting tomorrow 2pm and remind me 1 hour before"). Return all of them as separate objects in the "actions" array.
3. Return ONLY a valid JSON object formatted as:
{
  "actions": [
    { "type": "task" | "commitment" | "contact" | "note" | "reminder" | "inbox_items", "data": { ...fields } }
  ]
}`;

  const response = await completeJson({
    prompt: userPrompt,
    systemInstruction
  });

  if (!response || !Array.isArray(response.actions)) {
    throw new Error('Invalid response from AI: expected an object with an "actions" array.');
  }

  return response.actions;
}

export function showCommandPreviewModal(actions, onComplete) {
  let modalEl = document.getElementById('ai-command-modal');
  if (modalEl) {
    modalEl.remove();
  }

  modalEl = document.createElement('div');
  modalEl.id = 'ai-command-modal';
  modalEl.className = 'modal fade show';
  modalEl.style.display = 'block';
  modalEl.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalEl.setAttribute('tabindex', '-1');
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');

  const actionCardsHtml = (actions || []).map((action, idx) => {
    const rawType = action.type || 'inbox_items';
    const typeLabel = SINGULAR_LABELS[rawType] || rawType;
    const data = action.data || {};
    const title = data.title || data.name || data.content || `Action ${idx + 1}`;
    const timeStr = data.starts_at || data.due_at || data.remind_at;
    const timeBadge = timeStr ? ` · ${timeStr}` : '';

    const details = [];
    if (data.description) details.push(`Description: ${data.description}`);
    if (data.notes) details.push(`Notes: ${data.notes}`);
    if (data.location) details.push(`Location: ${data.location}`);
    if (data.attendees) details.push(`Attendees: ${data.attendees}`);
    if (data.priority) details.push(`Priority: ${data.priority}`);
    if (data.kind) details.push(`Kind: ${data.kind}`);
    if (data.email) details.push(`Email: ${data.email}`);
    if (data.phone) details.push(`Phone: ${data.phone}`);
    if (data.organization) details.push(`Org: ${data.organization}`);

    const detailText = details.length > 0 ? details.join(' | ') : JSON.stringify(data);

    return `
      <div class="card mb-2 shadow-sm">
        <div class="card-body py-2 px-3">
          <div class="form-check d-flex align-items-start">
            <input class="form-check-input me-2 mt-1 ai-command-action-cb" type="checkbox" id="ai-cmd-action-${idx}" data-index="${idx}" checked>
            <label class="form-check-label w-100" for="ai-cmd-action-${idx}">
              <div class="fw-semibold">
                <span class="badge bg-secondary me-1">[${typeLabel}]</span>
                ${escapeHtml(title)}${escapeHtml(timeBadge)}
              </div>
              <div class="text-muted small text-truncate mt-1">${escapeHtml(detailText)}</div>
            </label>
          </div>
        </div>
      </div>
    `;
  }).join('');

  modalEl.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header py-2">
          <h5 class="modal-title h6">✨ Proposed AI Actions (${(actions || []).length})</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body py-3">
          <div id="ai-command-modal-status" class="alert alert-info d-none mb-3"></div>
          <div id="ai-command-actions-list" style="max-height: 400px; overflow-y: auto;">
            ${actionCardsHtml || '<p class="empty-state">No actions proposed.</p>'}
          </div>
        </div>
        <div class="modal-footer py-2">
          <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-sm btn-success" id="ai-command-confirm-btn" ${!actions || actions.length === 0 ? 'disabled' : ''}>Confirm & Execute</button>
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

  const confirmBtn = modalEl.querySelector('#ai-command-confirm-btn');
  const statusEl = modalEl.querySelector('#ai-command-modal-status');
  const listEl = modalEl.querySelector('#ai-command-actions-list');

  const updateCheckedState = () => {
    const checkedCount = listEl.querySelectorAll('.ai-command-action-cb:checked').length;
    confirmBtn.disabled = checkedCount === 0;
  };

  listEl.querySelectorAll('.ai-command-action-cb').forEach(cb => {
    cb.addEventListener('change', updateCheckedState);
  });

  confirmBtn.addEventListener('click', async () => {
    const selectedIndices = Array.from(listEl.querySelectorAll('.ai-command-action-cb:checked'))
      .map(cb => parseInt(cb.dataset.index, 10));

    if (selectedIndices.length === 0) return;

    confirmBtn.disabled = true;
    statusEl.className = 'alert alert-info mb-3';
    statusEl.textContent = `Executing ${selectedIndices.length} action(s)...`;
    statusEl.classList.remove('d-none');

    try {
      for (const idx of selectedIndices) {
        const action = actions[idx];
        const targetType = TYPE_MAP[action.type] || action.type;
        await save(targetType, null, action.data);
      }
      closeModal();
      if (typeof onComplete === 'function') {
        onComplete();
      }
    } catch (err) {
      statusEl.className = 'alert alert-danger mb-3';
      statusEl.textContent = `Execution failed: ${err.message}`;
      confirmBtn.disabled = false;
    }
  });
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
