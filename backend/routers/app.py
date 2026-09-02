"""HTML routes. Routers contain request parsing; services own multi-record rules."""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from ..clock import now
from ..db import get_session
from ..models import Commitment, Contact, InboxItem, Note, Reminder, Task
from ..schemas import choice, local_datetime, text
from ..services.dashboard import context as dashboard_context
from ..services.recurrence import complete_task
from ..services.seed import reset_samples

router = APIRouter()
def redirect(url, message="Saved"):
    return RedirectResponse(f"{url}?message={message}", 303)
def render(request, template, **data):
    return request.app.state.templates.TemplateResponse(request, template, data)
def row(session, cls, ident):
    value=session.get(cls, ident)
    if not value: raise HTTPException(404, "Record not found")
    return value
async def data(request): return await request.form()
def ids(values): return [int(v) for v in values if str(v).isdigit()]

@router.get("/", response_class=HTMLResponse)
def dashboard(request: Request, session: Session=Depends(get_session)):
    return render(request, "dashboard.html", **dashboard_context(session))

@router.get("/tasks", response_class=HTMLResponse)
def tasks(request: Request, status: str="", priority: str="", session: Session=Depends(get_session)):
    q=select(Task)
    if status: q=q.where(Task.status==choice(status,{"open","completed"},"status"))
    if priority: q=q.where(Task.priority==choice(priority,{"low","medium","high"},"priority"))
    return render(request,"tasks.html", tasks=session.scalars(q.order_by(Task.status,Task.due_at)).all(), filters={"status":status,"priority":priority})
@router.get("/tasks/new", response_class=HTMLResponse)
def task_new(request:Request, session:Session=Depends(get_session)): return render(request,"task_form.html", task=None, commitments=session.scalars(select(Commitment)).all(), contacts=session.scalars(select(Contact)).all(), notes=session.scalars(select(Note)).all())
@router.post("/tasks/new")
async def task_create(request:Request, session:Session=Depends(get_session)):
    f=await data(request)
    try:
        task=Task(title=text(f.get("title",""),"Title"),description=f.get("description",""),priority=choice(f.get("priority","medium"),{"low","medium","high"},"priority"),due_at=local_datetime(f.get("due_at",""),"Due date"),recurrence=choice(f.get("recurrence","none"),{"none","daily","weekly","monthly"},"recurrence"),recurrence_until=local_datetime(f.get("recurrence_until",""),"Recurrence limit")); session.add(task); session.flush(); task.commitments=[row(session,Commitment,i) for i in ids(f.getlist("commitment_ids"))]; task.contacts=[row(session,Contact,i) for i in ids(f.getlist("contact_ids"))]; task.notes=[row(session,Note,i) for i in ids(f.getlist("note_ids"))]; session.commit()
    except HTTPException as e: session.rollback(); return HTMLResponse(str(e.detail),422)
    return redirect("/tasks","Task created")
@router.get("/tasks/{ident}/edit", response_class=HTMLResponse)
def task_edit(ident:int, request:Request, session:Session=Depends(get_session)): return render(request,"task_form.html",task=row(session,Task,ident),commitments=session.scalars(select(Commitment)).all(),contacts=session.scalars(select(Contact)).all(),notes=session.scalars(select(Note)).all())
@router.post("/tasks/{ident}/edit")
async def task_update(ident:int,request:Request,session:Session=Depends(get_session)):
    f=await data(request)
    try:
      task=row(session,Task,ident); task.title=text(f.get("title",""),"Title"); task.description=f.get("description",""); task.priority=choice(f.get("priority","medium"),{"low","medium","high"},"priority"); task.due_at=local_datetime(f.get("due_at",""),"Due date"); task.recurrence=choice(f.get("recurrence","none"),{"none","daily","weekly","monthly"},"recurrence"); task.recurrence_until=local_datetime(f.get("recurrence_until",""),"Recurrence limit"); task.commitments=[row(session,Commitment,i) for i in ids(f.getlist("commitment_ids"))]; task.contacts=[row(session,Contact,i) for i in ids(f.getlist("contact_ids"))]; task.notes=[row(session,Note,i) for i in ids(f.getlist("note_ids"))]; session.commit()
    except HTTPException as e: session.rollback(); return HTMLResponse(str(e.detail),422)
    return redirect("/tasks","Task updated")
@router.post("/tasks/{ident}/complete")
def task_complete(ident:int,session:Session=Depends(get_session)):
    complete_task(session,row(session,Task,ident)); session.commit(); return redirect("/tasks","Task completed")
@router.post("/tasks/{ident}/postpone")
async def task_postpone(ident:int,request:Request,session:Session=Depends(get_session)):
    try: row(session,Task,ident).due_at=local_datetime((await data(request)).get("due_at",""),"New due date",True); session.commit()
    except HTTPException as e: session.rollback(); return HTMLResponse(str(e.detail),422)
    return redirect("/tasks","Task postponed")

def overlaps(session, starts, duration, omit=None):
    if not duration:return []
    end=starts+timedelta(minutes=duration); candidates=session.scalars(select(Commitment).where(Commitment.duration_minutes.is_not(None),Commitment.status=="scheduled")).all()
    return [c for c in candidates if c.id != omit and c.starts_at < end and c.starts_at+timedelta(minutes=c.duration_minutes)>starts]
@router.get("/commitments",response_class=HTMLResponse)
def commitments(request:Request,session:Session=Depends(get_session)): return render(request,"commitments.html",commitments=session.scalars(select(Commitment).order_by(Commitment.starts_at)).all())
@router.get("/commitments/new",response_class=HTMLResponse)
def commitment_new(request:Request,session:Session=Depends(get_session)): return render(request,"commitment_form.html",commitment=None,contacts=session.scalars(select(Contact)).all(),tasks=session.scalars(select(Task)).all(),warnings=[])
async def save_commitment(request,session, obj=None):
 f=await data(request); starts=local_datetime(f.get("starts_at",""),"Start time",True); raw=f.get("duration_minutes",""); duration=int(raw) if raw else None
 if duration is not None and duration<=0: raise HTTPException(422,"Duration must be positive")
 if obj is None: obj=Commitment(); session.add(obj)
 obj.title=text(f.get("title",""),"Title"); obj.kind=choice(f.get("kind","other"),{"meeting","other"},"kind"); obj.starts_at=starts; obj.duration_minutes=duration; obj.location=f.get("location",""); obj.attendees=f.get("attendees",""); obj.notes=f.get("notes",""); obj.contacts=[row(session,Contact,i) for i in ids(f.getlist("contact_ids"))]; obj.tasks=[row(session,Task,i) for i in ids(f.getlist("task_ids"))]; session.flush(); warnings=overlaps(session,starts,duration,obj.id); session.commit(); return warnings
@router.post("/commitments/new")
async def commitment_create(request:Request,session:Session=Depends(get_session)):
 try: warnings=await save_commitment(request,session)
 except (HTTPException,ValueError) as e: session.rollback(); return HTMLResponse(str(getattr(e,"detail",e)),422)
 return redirect("/commitments", "Saved with overlap warning" if warnings else "Commitment created")
@router.get("/commitments/{ident}/edit",response_class=HTMLResponse)
def commitment_edit(ident:int,request:Request,session:Session=Depends(get_session)): return render(request,"commitment_form.html",commitment=row(session,Commitment,ident),contacts=session.scalars(select(Contact)).all(),tasks=session.scalars(select(Task)).all(),warnings=[])
@router.post("/commitments/{ident}/edit")
async def commitment_update(ident:int,request:Request,session:Session=Depends(get_session)):
 try: warnings=await save_commitment(request,session,row(session,Commitment,ident))
 except (HTTPException,ValueError) as e: session.rollback(); return HTMLResponse(str(getattr(e,"detail",e)),422)
 return redirect("/commitments", "Saved with overlap warning" if warnings else "Commitment updated")
@router.post("/commitments/{ident}/cancel")
def commitment_cancel(ident:int,session:Session=Depends(get_session)): row(session,Commitment,ident).status="cancelled";session.commit();return redirect("/commitments","Commitment cancelled")
@router.post("/commitments/{ident}/complete")
def commitment_complete(ident:int,session:Session=Depends(get_session)): row(session,Commitment,ident).status="completed";session.commit();return redirect("/commitments","Commitment completed")

@router.get("/contacts",response_class=HTMLResponse)
def contacts(request:Request,session:Session=Depends(get_session)): return render(request,"contacts.html",contacts=session.scalars(select(Contact).order_by(Contact.name)).all())
@router.get("/contacts/new",response_class=HTMLResponse)
def contact_new(request:Request): return render(request,"contact_form.html",contact=None)
async def save_contact(request,session,obj=None):
 f=await data(request); obj=obj or Contact(); session.add(obj); obj.name=text(f.get("name",""),"Name"); obj.email=f.get("email",""); obj.phone=f.get("phone",""); obj.organization=f.get("organization",""); obj.role=f.get("role",""); obj.relationship_context=f.get("relationship_context",""); session.commit()
@router.post("/contacts/new")
async def contact_create(request:Request,session:Session=Depends(get_session)):
 try: await save_contact(request,session)
 except HTTPException as e: session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/contacts","Contact created")
@router.get("/contacts/{ident}/edit",response_class=HTMLResponse)
def contact_edit(ident:int,request:Request,session:Session=Depends(get_session)): return render(request,"contact_form.html",contact=row(session,Contact,ident))
@router.post("/contacts/{ident}/edit")
async def contact_update(ident:int,request:Request,session:Session=Depends(get_session)):
 try: await save_contact(request,session,row(session,Contact,ident))
 except HTTPException as e: session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/contacts","Contact updated")
@router.post("/contacts/{ident}/delete")
def contact_delete(ident:int,session:Session=Depends(get_session)):
 c=row(session,Contact,ident)
 if c.tasks or c.commitments or c.notes: return HTMLResponse("Contact must be unlinked before deletion",422)
 session.delete(c);session.commit();return redirect("/contacts","Contact deleted")

@router.get("/notes",response_class=HTMLResponse)
def notes(request:Request,session:Session=Depends(get_session)): return render(request,"notes.html",notes=session.scalars(select(Note).order_by(Note.updated_at.desc())).all())
@router.get("/notes/new",response_class=HTMLResponse)
def note_new(request:Request,session:Session=Depends(get_session)): return render(request,"note_form.html",note=None,tasks=session.scalars(select(Task)).all(),contacts=session.scalars(select(Contact)).all(),commitments=session.scalars(select(Commitment)).all())
async def save_note(request,session,obj=None):
 f=await data(request); obj=obj or Note();session.add(obj); obj.title=f.get("title","");obj.content=text(f.get("content",""),"Content");obj.kind=choice(f.get("kind","general"),{"general","preparation","follow_up"},"note kind"); commitment_id=f.get("commitment_id","");obj.commitment=row(session,Commitment,int(commitment_id)) if commitment_id else None;obj.tasks=[row(session,Task,i) for i in ids(f.getlist("task_ids"))];obj.contacts=[row(session,Contact,i) for i in ids(f.getlist("contact_ids"))];session.commit()
@router.post("/notes/new")
async def note_create(request:Request,session:Session=Depends(get_session)):
 try: await save_note(request,session)
 except HTTPException as e:session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/notes","Note created")
@router.get("/notes/{ident}/edit",response_class=HTMLResponse)
def note_edit(ident:int,request:Request,session:Session=Depends(get_session)): return render(request,"note_form.html",note=row(session,Note,ident),tasks=session.scalars(select(Task)).all(),contacts=session.scalars(select(Contact)).all(),commitments=session.scalars(select(Commitment)).all())
@router.post("/notes/{ident}/edit")
async def note_update(ident:int,request:Request,session:Session=Depends(get_session)):
 try:await save_note(request,session,row(session,Note,ident))
 except HTTPException as e:session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/notes","Note updated")

@router.get("/inbox",response_class=HTMLResponse)
def inbox(request:Request,session:Session=Depends(get_session)):return render(request,"inbox.html",items=session.scalars(select(InboxItem).order_by(InboxItem.updated_at.desc())).all())
@router.get("/inbox/new",response_class=HTMLResponse)
def inbox_new(request:Request):return render(request,"inbox_form.html",item=None)
@router.post("/inbox/new")
async def inbox_create(request:Request,session:Session=Depends(get_session)):
 try:item=InboxItem(content=text((await data(request)).get("content",""),"Content"));session.add(item);session.commit()
 except HTTPException as e:session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/inbox","Inbox item captured")
@router.get("/inbox/{ident}/edit",response_class=HTMLResponse)
def inbox_edit(ident:int,request:Request,session:Session=Depends(get_session)):return render(request,"inbox_form.html",item=row(session,InboxItem,ident))
@router.post("/inbox/{ident}/edit")
async def inbox_update(ident:int,request:Request,session:Session=Depends(get_session)):
 try: row(session,InboxItem,ident).content=text((await data(request)).get("content",""),"Content");session.commit()
 except HTTPException as e:session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/inbox","Inbox item updated")
@router.post("/inbox/{ident}/process")
async def inbox_process(ident:int,request:Request,session:Session=Depends(get_session)):
 f=await data(request); item=row(session,InboxItem,ident)
 if item.status!="pending":return HTMLResponse("Only pending items may be processed",422)
 try:
  kind=choice(f.get("processed_type",""),{"task","note","reminder"},"processing type")
  if kind=="task": created=Task(title=text(f.get("title",item.content),"Title"),description=item.content,priority=choice(f.get("priority","medium"),{"low","medium","high"},"priority"),due_at=local_datetime(f.get("due_at",""),"Due date"))
  elif kind=="note":created=Note(title=f.get("title",""),content=item.content)
  else:created=Reminder(title=text(f.get("title",item.content),"Title"),remind_at=local_datetime(f.get("remind_at",""),"Reminder time",True))
  session.add(created);session.flush();item.status="processed";item.processed_type=kind;item.processed_id=created.id;session.commit()
 except HTTPException as e:session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/inbox",f"Processed as {kind}")
@router.post("/inbox/{ident}/dismiss")
def inbox_dismiss(ident:int,session:Session=Depends(get_session)):row(session,InboxItem,ident).status="dismissed";session.commit();return redirect("/inbox","Inbox item dismissed")

@router.get("/reminders",response_class=HTMLResponse)
def reminders(request:Request,session:Session=Depends(get_session)):return render(request,"reminders.html",reminders=session.scalars(select(Reminder).order_by(Reminder.remind_at)).all())
@router.get("/reminders/new",response_class=HTMLResponse)
def reminder_new(request:Request,session:Session=Depends(get_session)):return render(request,"reminder_form.html",tasks=session.scalars(select(Task)).all(),commitments=session.scalars(select(Commitment)).all())
@router.post("/reminders/new")
async def reminder_create(request:Request,session:Session=Depends(get_session)):
 f=await data(request)
 try:
  tid=f.get("task_id","");cid=f.get("commitment_id","")
  if tid and cid:raise HTTPException(422,"A reminder can link to only one record")
  session.add(Reminder(title=text(f.get("title",""),"Title"),remind_at=local_datetime(f.get("remind_at",""),"Reminder time",True),task_id=row(session,Task,int(tid)).id if tid else None,commitment_id=row(session,Commitment,int(cid)).id if cid else None));session.commit()
 except HTTPException as e:session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/reminders","Reminder created")
@router.post("/reminders/{ident}/acknowledge")
def reminder_ack(ident:int,session:Session=Depends(get_session)):row(session,Reminder,ident).status="acknowledged";session.commit();return redirect("/reminders","Reminder acknowledged")
@router.post("/reminders/{ident}/dismiss")
def reminder_dismiss(ident:int,session:Session=Depends(get_session)):row(session,Reminder,ident).status="dismissed";session.commit();return redirect("/reminders","Reminder dismissed")
@router.post("/reminders/{ident}/snooze")
async def reminder_snooze(ident:int,request:Request,session:Session=Depends(get_session)):
 try:r=row(session,Reminder,ident);r.remind_at=local_datetime((await data(request)).get("remind_at",""),"New reminder time",True);r.status="snoozed";session.commit()
 except HTTPException as e:session.rollback();return HTMLResponse(str(e.detail),422)
 return redirect("/reminders","Reminder snoozed")

@router.get("/search",response_class=HTMLResponse)
def search(request:Request,q:str="",type:str="",session:Session=Depends(get_session)):
 allowed={"task":Task,"commitment":Commitment,"contact":Contact,"note":Note,"reminder":Reminder,"inbox":InboxItem};
 if type and type not in allowed:raise HTTPException(422,"Invalid search type")
 results=[]
 for label,cls in allowed.items():
  if type and type!=label:continue
  columns={Task:[Task.title,Task.description],Commitment:[Commitment.title,Commitment.location,Commitment.notes],Contact:[Contact.name,Contact.email,Contact.organization,Contact.relationship_context],Note:[Note.title,Note.content],Reminder:[Reminder.title],InboxItem:[InboxItem.content]}[cls]
  if q.strip():
   condition=or_(*[col.ilike(f"%{q.strip()}%") for col in columns]);records=session.scalars(select(cls).where(condition)).all()
   results += [(label,r, f"/{'inbox' if label=='inbox' else label+'s'}/{r.id}/edit") for r in records]
 return render(request,"search.html",q=q,type=type,results=results)
@router.post("/seed/reset")
def seed_reset(session:Session=Depends(get_session)):reset_samples(session);return redirect("/","Sample data reset")
