/* sql.js is intentionally confined to this worker; views never see SQL. */
let SQL, database, storage, initialized = false, fatal = null;
let queue = Promise.resolve();
const ops = new Map();
const types = new Set(['tasks','commitments','contacts','notes','reminders','inbox_items']);
const links = {tasks:[['task_commitments','task_id','commitment_id','commitment_ids'],['task_contacts','task_id','contact_id','contact_ids'],['task_notes','task_id','note_id','note_ids']], commitments:[['task_commitments','commitment_id','task_id','task_ids'],['commitment_contacts','commitment_id','contact_id','contact_ids']], notes:[['task_notes','note_id','task_id','task_ids'],['contact_notes','note_id','contact_id','contact_ids']]};
const typeLabel = {tasks:'task',commitments:'commitment',contacts:'contact',notes:'note',reminders:'reminder',inbox_items:'inbox'};

function register(name, handler, write=false) { ops.set(name,{handler,write}); }
function rows(sql, params=[]) { const s=database.prepare(sql); try { s.bind(params); const out=[]; while(s.step()) out.push(s.getAsObject()); return out; } finally { s.free(); } }
function one(sql, params=[]) { return rows(sql,params)[0] || null; }
function run(sql, params=[]) { database.run(sql,params); }
function localStamp(value = new Date()) { const p=(n)=>String(n).padStart(2,'0'); return `${value.getFullYear()}-${p(value.getMonth()+1)}-${p(value.getDate())}T${p(value.getHours())}:${p(value.getMinutes())}:${p(value.getSeconds())}`; }
function mustText(value, label, max=200) { const text=String(value || '').trim(); if (!text) throw new Error(`${label} is required`); if(text.length>max) throw new Error(`${label} is too long`); return text; }
function choice(value, values, label) { if(!values.includes(value)) throw new Error(`Invalid ${label}`); return value; }
function idList(value) { return [...new Set((Array.isArray(value)?value:[]).map(Number).filter(Number.isInteger))]; }
function existing(table,id) { const r=one(`SELECT id FROM ${table} WHERE id=?`,[id]); if(!r) throw new Error('Related record was not found'); return id; }
function table(type) { if(!types.has(type)) throw new Error('Unknown record type'); return type; }
function getLinks(type,id) { const result={}; for(const [join,own,other,key] of links[type]||[]) result[key]=rows(`SELECT ${other} AS id FROM ${join} WHERE ${own}=? ORDER BY ${other}`,[id]).map(r=>r.id); return result; }
function replaceLinks(type,id,data) { for(const [join,own,other,key] of links[type]||[]) { run(`DELETE FROM ${join} WHERE ${own}=?`,[id]); for(const related of idList(data[key])) { const target={commitment_ids:'commitments',contact_ids:'contacts',note_ids:'notes',task_ids:'tasks'}[key]; existing(target,related); run(`INSERT INTO ${join} (${own},${other}) VALUES (?,?)`,[id,related]); } } }
function record(type,id) { const row=one(`SELECT * FROM ${table(type)} WHERE id=?`,[id]); if(!row) throw new Error('Record not found'); return {...row,...getLinks(type,id)}; }
function asLocalDate(stamp) { return new Date(`${String(stamp).slice(0,16)}:00`); }
function addDays(stamp, days) { const date=asLocalDate(stamp); date.setDate(date.getDate()+days); return localStamp(date); }
function addHours(stamp, hours) { const date=asLocalDate(stamp); date.setHours(date.getHours()+hours); return localStamp(date); }
function seed() {
  const now=localStamp();
  const insert=(name, fields) => { const columns=Object.keys(fields); run(`INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,Object.values(fields)); return one('SELECT last_insert_rowid() AS id').id; };
  const sample=(fields)=>({...fields,is_sample:1,created_at:now,updated_at:now});
  const contacts={};
  [
    ['jordan',{name:'Jordan Lee',email:'jordan@northstarlabs.example',phone:'555-0142',organization:'Northstar Labs',role:'Product partner',relationship_context:'Primary launch partner; prefers a concise Friday status note.'}],
    ['maya',{name:'Maya Patel',email:'maya@brightline.example',phone:'555-0188',organization:'Brightline Studio',role:'Design director',relationship_context:'Leads the design-system work. Include her in accessibility decisions.'}],
    ['marcus',{name:'Marcus Chen',email:'marcus@harborside.example',phone:'555-0127',organization:'Harborside Capital',role:'Operating partner',relationship_context:'Quarterly advisor and potential customer introduction source.'}],
    ['elena',{name:'Elena Rodriguez',email:'elena@northstarlabs.example',phone:'555-0175',organization:'Northstar Labs',role:'Engineering lead',relationship_context:'Owns the integration timeline and release readiness.'}],
    ['noah',{name:'Noah Williams',email:'noah@clearwater.example',phone:'555-0151',organization:'Clearwater Health',role:'Customer success lead',relationship_context:'Pilot customer champion; checks in every other week.'}],
    ['priya',{name:'Priya Shah',email:'priya@counsel.example',phone:'555-0194',organization:'Shah & Morgan',role:'Counsel',relationship_context:'Review privacy and commercial terms before pilot expansion.'}],
    ['sam',{name:'Sam Okafor',email:'sam@northstarlabs.example',phone:'555-0163',organization:'Northstar Labs',role:'Operations manager',relationship_context:'Coordinates vendor renewals, travel, and company all-hands.'}],
    ['lina',{name:'Lina Berg',email:'lina@fieldnotes.example',phone:'555-0118',organization:'Field Notes Research',role:'Research partner',relationship_context:'Runs customer interviews and synthesizes insight reports.'}]
  ]
    .forEach(([key,fields])=>contacts[key]=insert('contacts',sample(fields)));
  const commitments={};
  [
    ['planning',{title:'Product planning',kind:'meeting',starts_at:addHours(now,20),duration_minutes:45,location:'Video call',attendees:'Jordan Lee, Elena Rodriguez',notes:'Decide launch scope and confirm the integration milestone.'}],
    ['design',{title:'Design-system review',kind:'meeting',starts_at:addDays(now,2),duration_minutes:60,location:'Studio 4B',attendees:'Maya Patel, Elena Rodriguez',notes:'Review the dashboard and quick-capture interaction patterns.'}],
    ['pilot',{title:'Clearwater pilot check-in',kind:'meeting',starts_at:addDays(now,3),duration_minutes:30,location:'Video call',attendees:'Noah Williams',notes:'Discuss adoption, support issues, and pilot extension criteria.'}],
    ['advisor',{title:'Advisor office hours',kind:'meeting',starts_at:addDays(now,5),duration_minutes:45,location:'Harborside Capital',attendees:'Marcus Chen',notes:'Share progress, risks, and requests for introductions.'}],
    ['allhands',{title:'Company all-hands',kind:'other',starts_at:addDays(now,6),duration_minutes:60,location:'Main conference room',attendees:'Northstar Labs team',notes:'Team updates, operating metrics, and open Q&A.'}],
    ['privacy',{title:'Privacy terms review',kind:'meeting',starts_at:addDays(now,8),duration_minutes:45,location:'Video call',attendees:'Priya Shah',notes:'Review pilot data-processing language and open questions.'}],
    ['past',{title:'Last week launch retrospective',kind:'meeting',starts_at:addDays(now,-4),duration_minutes:60,location:'Video call',attendees:'Jordan Lee, Maya Patel',notes:'Completed retrospective with follow-up actions captured.',status:'completed'}],
    ['cancelled',{title:'Vendor evaluation call',kind:'other',starts_at:addDays(now,4),duration_minutes:30,location:'Phone',attendees:'Sam Okafor',notes:'Reschedule once the revised proposal arrives.',status:'cancelled'}]
  ]
    .forEach(([key,fields])=>commitments[key]=insert('commitments',sample({...fields,status:fields.status||'scheduled'})));
  const tasks={};
  [
    ['priorities',{title:'Review weekly priorities',description:'Select the three outcomes that matter most this week and communicate tradeoffs.',priority:'high',due_at:addHours(now,3)}],
    ['recap',{title:'Send product planning recap',description:'Summarize decisions, owners, and unresolved questions after planning.',priority:'medium',due_at:addDays(now,1),recurrence:'weekly'}],
    ['brief',{title:'Prepare Clearwater pilot brief',description:'Pull adoption metrics, top support themes, and the renewal timeline.',priority:'high',due_at:addDays(now,2)}],
    ['design',{title:'Review dashboard design changes',description:'Leave actionable feedback on the new quick-capture and reminder screens.',priority:'medium',due_at:addDays(now,2)}],
    ['terms',{title:'Send privacy questions to counsel',description:'Clarify retention, access controls, and the pilot expansion language.',priority:'high',due_at:addDays(now,6)}],
    ['budget',{title:'Approve Q4 tooling budget',description:'Compare the revised vendor quotes before the finance cutoff.',priority:'medium',due_at:addDays(now,7)}],
    ['interviews',{title:'Read customer interview synthesis',description:'Highlight recurring requests and decide which themes need follow-up.',priority:'low',due_at:addDays(now,4)}],
    ['travel',{title:'Confirm advisor meeting travel',description:'Book train and add the office address to the calendar invite.',priority:'low',due_at:addDays(now,4)}],
    ['overdue',{title:'Reply to partner introduction',description:'Thank Marcus and propose two times for a first conversation.',priority:'high',due_at:addDays(now,-1)}],
    ['completed',{title:'Publish launch retrospective notes',description:'Share the agreed lessons and ownership list with the team.',priority:'medium',due_at:addDays(now,-2),status:'completed',completed_at:addDays(now,-1)}],
    ['metrics',{title:'Update weekly operating metrics',description:'Refresh the team dashboard before all-hands.',priority:'medium',due_at:addDays(now,6),recurrence:'weekly',recurrence_until:addDays(now,70)}]
  ]
    .forEach(([key,fields])=>tasks[key]=insert('tasks',sample({...fields,status:fields.status||'open',recurrence:fields.recurrence||'none'})));
  const taskLink=(task, commitment)=>run('INSERT INTO task_commitments VALUES (?,?)',[tasks[task],commitments[commitment]]);
  const taskContact=(task, contact)=>run('INSERT INTO task_contacts VALUES (?,?)',[tasks[task],contacts[contact]]);
  const commitmentContact=(commitment, contact)=>run('INSERT INTO commitment_contacts VALUES (?,?)',[commitments[commitment],contacts[contact]]);
  [['priorities','planning'],['recap','planning'],['brief','pilot'],['design','design'],['terms','privacy'],['budget','allhands'],['travel','advisor'],['metrics','allhands'],['completed','past']].forEach(([a,b])=>taskLink(a,b));
  [['priorities','elena'],['recap','jordan'],['brief','noah'],['design','maya'],['terms','priya'],['budget','sam'],['interviews','lina'],['travel','marcus'],['overdue','marcus']].forEach(([a,b])=>taskContact(a,b));
  [['planning','jordan'],['planning','elena'],['design','maya'],['design','elena'],['pilot','noah'],['advisor','marcus'],['privacy','priya'],['allhands','sam'],['past','jordan'],['past','maya']].forEach(([a,b])=>commitmentContact(a,b));
  const notes={};
  [
    ['planning',{title:'Planning agenda',content:'Review launch scope, integration readiness, decision owners, and the next customer checkpoint.',kind:'preparation',commitment_id:commitments.planning}],
    ['planningFollow',{title:'Planning follow-up',content:'Jordan owns partner communication. Elena will publish the integration readiness checklist by Thursday.',kind:'follow_up',commitment_id:commitments.planning}],
    ['pilot',{title:'Clearwater pilot talking points',content:'Ask about weekly active usage, clinician feedback, export workflow friction, and what would justify expansion.',kind:'preparation',commitment_id:commitments.pilot}],
    ['design',{title:'Design review questions',content:'Focus on quick capture, visual priority hierarchy, keyboard behavior, and empty-state guidance.',kind:'preparation',commitment_id:commitments.design}],
    ['advisor',{title:'Advisor update outline',content:'Progress: pilot adoption and integration. Risks: privacy review timing. Ask: two enterprise introductions.',kind:'preparation',commitment_id:commitments.advisor}],
    ['research',{title:'Interview synthesis themes',content:'Customers value quick triage, clearer ownership, and follow-up prompts after meetings.',kind:'general'}],
    ['retro',{title:'Launch retrospective outcomes',content:'Keep the release checklist short, set explicit owners earlier, and schedule a customer follow-up before launch.',kind:'follow_up',commitment_id:commitments.past}]
  ]
    .forEach(([key,fields])=>notes[key]=insert('notes',sample(fields)));
  const taskNote=(task,note)=>run('INSERT INTO task_notes VALUES (?,?)',[tasks[task],notes[note]]);
  const contactNote=(contact,note)=>run('INSERT INTO contact_notes VALUES (?,?)',[contacts[contact],notes[note]]);
  [['recap','planningFollow'],['brief','pilot'],['design','design'],['interviews','research'],['travel','advisor']].forEach(([a,b])=>taskNote(a,b));
  [['jordan','planning'],['jordan','planningFollow'],['noah','pilot'],['maya','design'],['marcus','advisor'],['lina','research']].forEach(([a,b])=>contactNote(a,b));
  [
    {title:'Prepare planning agenda',remind_at:addHours(now,16),commitment_id:commitments.planning,status:'upcoming'},
    {title:'Review pilot metrics',remind_at:addDays(now,2),task_id:tasks.brief,status:'upcoming'},
    {title:'Book advisor travel',remind_at:addDays(now,3),task_id:tasks.travel,status:'upcoming'},
    {title:'Privacy review prep',remind_at:addDays(now,7),commitment_id:commitments.privacy,status:'snoozed'},
    {title:'Send product recap',remind_at:addDays(now,-1),task_id:tasks.recap,status:'acknowledged'},
    {title:'Read research synthesis',remind_at:addDays(now,-2),task_id:tasks.interviews,status:'dismissed'}
  ].forEach(fields=>insert('reminders',sample(fields)));
  [
    {content:'Ask Jordan whether the partner launch dates are still realistic.',status:'pending'},
    {content:'Capture two customer quotes from the latest interview recording.',status:'pending'},
    {content:'Decide whether the design review needs a follow-up workshop.',status:'pending'},
    {content:'Order thank-you cards for the pilot team.',status:'pending'},
    {content:'Follow up with Marcus about the enterprise introduction.',status:'processed',processed_type:'task',processed_id:tasks.overdue},
    {content:'Save the launch retrospective takeaways.',status:'processed',processed_type:'note',processed_id:notes.retro},
    {content:'Consider a reminder for the monthly vendor audit.',status:'dismissed'}
  ].forEach(fields=>insert('inbox_items',sample(fields)));
}
async function initialize() {
  if(initialized) return; if(fatal) throw fatal;
  importScripts(new URL('../../vendor/sql.js/sql-wasm.js',self.location.href).href);
  SQL=await initSqlJs({locateFile:()=>new URL('../../vendor/sql.js/sql-wasm.wasm',self.location.href).href});
  const [{WorkspaceStorage},{seedSql,validateDatabase}] = await Promise.all([import('./persistence.js'),import('./schema.js')]);
  storage=new WorkspaceStorage(); const bytes=await storage.open();
  if(bytes.byteLength) { database=new SQL.Database(bytes); try { validateDatabase(database); } catch(error) { database.close(); throw error; } }
  else { database=new SQL.Database(); database.run(seedSql); seed(); await persist(); }
  database.run('PRAGMA foreign_keys=ON'); initialized=true;
}
function snapshot() { try { return database.export(); } finally { database.run('PRAGMA foreign_keys=ON'); } }
async function recover(error) { try { database.close(); database=new SQL.Database(new Uint8Array(await storage.export())); database.run('PRAGMA foreign_keys=ON'); } catch(recovery) { fatal=new Error(`Workspace recovery failed; reload required: ${recovery.message}`); throw fatal; } throw error; }
async function persist() { try { await storage.replace(snapshot()); } catch(error) { return recover(error); } }
function status() { return {...storage.metadata, workspaceBytes:storage?.workspaceBytes || 0, state:fatal?'failed':'saved'}; }

register('workspace.init',()=>status()); register('workspace.status',()=>status());
register('workspace.export',()=>snapshot().buffer);
register('workspace.reset',()=>{ resetSamples(); return status(); },true);
register('workspace.import',async ({bytes})=>{ const {validateDatabase}=await import('./schema.js'); const candidate=new SQL.Database(new Uint8Array(bytes)); try { validateDatabase(candidate); } catch(error) { candidate.close(); throw error; } database.close(); database=candidate; database.run('PRAGMA foreign_keys=ON'); return status(); },true);

register('dashboard.get',()=>{ const current=localStamp(), today=current.slice(0,10), start=`${today}T00:00:00`, end=addDays(start,1), horizon=addDays(current,7); return {today,priority_tasks:rows("SELECT * FROM tasks WHERE status='open' AND priority='high' AND due_at>=? AND due_at<? ORDER BY due_at",[start,end]),overdue_tasks:rows("SELECT * FROM tasks WHERE status='open' AND due_at IS NOT NULL AND due_at<? ORDER BY due_at",[current]),commitments:rows("SELECT * FROM commitments WHERE status='scheduled' AND starts_at>=? AND starts_at<=? ORDER BY starts_at",[current,horizon]),inbox_count:one("SELECT count(*) AS count FROM inbox_items WHERE status='pending'").count,reminders:rows("SELECT * FROM reminders WHERE status IN ('upcoming','snoozed') ORDER BY remind_at")}; });
register('records.list',({type,filters={}})=>{ table(type); let sql=`SELECT * FROM ${type}`, where=[],params=[]; if(filters.status){where.push('status=?');params.push(filters.status)} if(filters.priority){where.push('priority=?');params.push(filters.priority)} if(where.length)sql+=' WHERE '+where.join(' AND '); const order={tasks:'status, due_at',commitments:'starts_at',contacts:'name',notes:'updated_at DESC',reminders:'remind_at',inbox_items:'updated_at DESC'}[type]; return rows(`${sql} ORDER BY ${order}`,params); });
register('records.get',({type,id})=>record(type,id));
register('records.save',({type,id,data})=>save(type,id,data),true);
register('records.action',({type,id,name,data})=>action(type,id,name,data),true);
register('search',({q='',type=''})=>{ const term=String(q).trim(); const allowed=type ? [type==='inbox'?'inbox_items':`${type}s`] : [...types]; if(!term)return []; const columns={tasks:['title','description'],commitments:['title','location','notes'],contacts:['name','email','organization','relationship_context'],notes:['title','content'],reminders:['title'],inbox_items:['content']}; const output=[]; for(const item of allowed){ if(!types.has(item))throw new Error('Invalid search type'); const clause=columns[item].map(c=>`lower(${c}) LIKE lower(?)`).join(' OR '); for(const row of rows(`SELECT * FROM ${item} WHERE ${clause}`,columns[item].map(()=>`%${term}%`))) output.push({type:typeLabel[item],id:row.id,title:row.title||row.name||row.content}); } return output; });

function save(type,id,data) {
  const now=localStamp(); table(type); const update=Boolean(id); if(update) record(type,id);
  if(type==='tasks') { const values=[mustText(data.title,'Title'),String(data.description||''),choice(data.priority||'medium',['low','medium','high'],'priority'),data.due_at||null,choice(data.recurrence||'none',['none','daily','weekly','monthly'],'recurrence'),data.recurrence_until||null,now]; if(update) run('UPDATE tasks SET title=?,description=?,priority=?,due_at=?,recurrence=?,recurrence_until=?,updated_at=? WHERE id=?',[...values,id]); else {run('INSERT INTO tasks (title,description,priority,due_at,recurrence,recurrence_until,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[...values,now]);id=one('SELECT last_insert_rowid() AS id').id;} replaceLinks(type,id,data); }
  else if(type==='commitments') { const duration=data.duration_minutes===''||data.duration_minutes==null?null:Number(data.duration_minutes); if(duration!==null && (!Number.isInteger(duration)||duration<1))throw new Error('Duration must be a positive integer'); const values=[mustText(data.title,'Title'),choice(data.kind||'other',['meeting','other'],'type'),mustText(data.starts_at,'Start time'),duration,String(data.location||''),String(data.attendees||''),String(data.notes||''),now]; if(update)run('UPDATE commitments SET title=?,kind=?,starts_at=?,duration_minutes=?,location=?,attendees=?,notes=?,updated_at=? WHERE id=?',[...values,id]);else{run('INSERT INTO commitments (title,kind,starts_at,duration_minutes,location,attendees,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',[...values,now]);id=one('SELECT last_insert_rowid() AS id').id;}replaceLinks(type,id,data); }
  else if(type==='contacts') { const values=[mustText(data.name,'Name',160),String(data.email||''),String(data.phone||''),String(data.organization||''),String(data.role||''),String(data.relationship_context||''),now]; if(update)run('UPDATE contacts SET name=?,email=?,phone=?,organization=?,role=?,relationship_context=?,updated_at=? WHERE id=?',[...values,id]);else{run('INSERT INTO contacts (name,email,phone,organization,role,relationship_context,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[...values,now]);id=one('SELECT last_insert_rowid() AS id').id;} }
  else if(type==='notes') { const commitment=data.commitment_id?existing('commitments',Number(data.commitment_id)):null; const values=[String(data.title||''),mustText(data.content,'Content',100000),choice(data.kind||'general',['general','preparation','follow_up'],'note kind'),commitment,now];if(update)run('UPDATE notes SET title=?,content=?,kind=?,commitment_id=?,updated_at=? WHERE id=?',[...values,id]);else{run('INSERT INTO notes (title,content,kind,commitment_id,created_at,updated_at) VALUES (?,?,?,?,?,?)',[...values,now]);id=one('SELECT last_insert_rowid() AS id').id;}replaceLinks(type,id,data); }
  else if(type==='reminders') { const task=data.task_id?existing('tasks',Number(data.task_id)):null, commitment=data.commitment_id?existing('commitments',Number(data.commitment_id)):null;if(task&&commitment)throw new Error('A reminder can link to only one record');const values=[mustText(data.title,'Title'),mustText(data.remind_at,'Reminder time'),task,commitment,now];if(update)run('UPDATE reminders SET title=?,remind_at=?,task_id=?,commitment_id=?,updated_at=? WHERE id=?',[...values,id]);else{run('INSERT INTO reminders (title,remind_at,task_id,commitment_id,created_at,updated_at) VALUES (?,?,?,?,?,?)',[...values,now]);id=one('SELECT last_insert_rowid() AS id').id;} }
  else if(type==='inbox_items') { const content=mustText(data.content,'Content',100000);if(update)run('UPDATE inbox_items SET content=?,updated_at=? WHERE id=?',[content,now,id]);else{run('INSERT INTO inbox_items (content,created_at,updated_at) VALUES (?,?,?)',[content,now]);id=one('SELECT last_insert_rowid() AS id').id;} }
  return {...record(type,id), warnings:type==='commitments'?overlaps(id):[]};
}
function resetSamples() {
  // Mirror backend/services/seed.py: remove only sample relationships and rows.
  const sample={tasks:"SELECT id FROM tasks WHERE is_sample=1",contacts:"SELECT id FROM contacts WHERE is_sample=1",notes:"SELECT id FROM notes WHERE is_sample=1",commitments:"SELECT id FROM commitments WHERE is_sample=1"};
  run(`DELETE FROM contact_notes WHERE contact_id IN (${sample.contacts}) OR note_id IN (${sample.notes})`);
  run(`DELETE FROM commitment_contacts WHERE commitment_id IN (${sample.commitments}) OR contact_id IN (${sample.contacts})`);
  run(`DELETE FROM task_notes WHERE task_id IN (${sample.tasks}) OR note_id IN (${sample.notes})`);
  run(`DELETE FROM task_contacts WHERE task_id IN (${sample.tasks}) OR contact_id IN (${sample.contacts})`);
  run(`DELETE FROM task_commitments WHERE task_id IN (${sample.tasks}) OR commitment_id IN (${sample.commitments})`);
  for(const name of ['reminders','notes','inbox_items','commitments','contacts','tasks']) run(`DELETE FROM ${name} WHERE is_sample=1`);
  seed();
}
function overlaps(id) { const target=record('commitments',id);if(!target.duration_minutes)return []; const end=asLocalDate(target.starts_at).getTime()+target.duration_minutes*60000;return rows("SELECT * FROM commitments WHERE id<>? AND status='scheduled' AND duration_minutes IS NOT NULL",[id]).filter(item=>asLocalDate(item.starts_at).getTime()<end && asLocalDate(item.starts_at).getTime()+item.duration_minutes*60000>asLocalDate(target.starts_at).getTime()); }
function action(type,id,name,data) { const now=localStamp(); const current=record(type,id); if(type==='tasks'&&name==='complete'){if(current.status==='completed')return current;run("UPDATE tasks SET status='completed',completed_at=?,updated_at=? WHERE id=?",[now,now,id]);if(current.recurrence!=='none'){const days={daily:1,weekly:7,monthly:30}[current.recurrence], due=addDays(current.due_at||now,days);if(!current.recurrence_until||due<=current.recurrence_until)run('INSERT INTO tasks (title,description,priority,due_at,recurrence,recurrence_until,source_task_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',[current.title,current.description,current.priority,due,current.recurrence,current.recurrence_until,id,now,now]);}return record(type,id);} if(type==='tasks'&&name==='postpone'){const due=mustText(data.due_at,'New due date');run('UPDATE tasks SET due_at=?,updated_at=? WHERE id=?',[due,now,id]);return record(type,id);} if(type==='commitments'&&['cancel','complete'].includes(name)){run('UPDATE commitments SET status=?,updated_at=? WHERE id=?',[name==='cancel'?'cancelled':'completed',now,id]);return record(type,id);}if(type==='contacts'&&name==='delete'){for(const join of ['task_contacts','commitment_contacts','contact_notes'])if(one(`SELECT 1 AS found FROM ${join} WHERE contact_id=?`,[id]))throw new Error('Contact must be unlinked before deletion');run('DELETE FROM contacts WHERE id=?',[id]);return null;}if(type==='inbox_items'&&name==='dismiss'){run("UPDATE inbox_items SET status='dismissed',updated_at=? WHERE id=?",[now,id]);return record(type,id);}if(type==='inbox_items'&&name==='process'){if(current.status!=='pending')throw new Error('Only pending items may be processed');const kind=choice(data.processed_type,['task','note','reminder'],'processing type');let created;if(kind==='task')created=save('tasks',null,{title:data.title||current.content,description:current.content,priority:data.priority||'medium',due_at:data.due_at||null});else if(kind==='note')created=save('notes',null,{title:data.title||'',content:current.content,kind:'general'});else created=save('reminders',null,{title:data.title||current.content,remind_at:data.remind_at});run("UPDATE inbox_items SET status='processed',processed_type=?,processed_id=?,updated_at=? WHERE id=?",[kind,created.id,now,id]);return record(type,id);}if(type==='reminders'&&['acknowledge','dismiss'].includes(name)){run('UPDATE reminders SET status=?,updated_at=? WHERE id=?',[name==='acknowledge'?'acknowledged':'dismissed',now,id]);return record(type,id);}if(type==='reminders'&&name==='snooze'){run("UPDATE reminders SET remind_at=?,status='snoozed',updated_at=? WHERE id=?",[mustText(data.remind_at,'New reminder time'),now,id]);return record(type,id);}throw new Error('Unsupported action'); }

async function dispatch(op,payload) { await initialize(); if(fatal)throw fatal; const entry=ops.get(op);if(!entry)throw new Error(`Unknown operation: ${op}`);if(!entry.write)return entry.handler(payload);database.run('BEGIN');try{const result=await entry.handler(payload);database.run('COMMIT');await persist();return result;}catch(error){try{database.run('ROLLBACK')}catch{}throw error;} }
self.onmessage=({data:{id,op,payload={}}})=>{queue=queue.then(async()=>{try{const result=await dispatch(op,payload);self.postMessage({id,result},result instanceof ArrayBuffer?[result]:[]);}catch(error){self.postMessage({id,error:{message:error.message,name:error.name}});}});};
