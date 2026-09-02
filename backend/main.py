from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, create_engine, or_, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

DB = Path(__file__).resolve().parent.parent / "assistant.db"
engine = create_engine(f"sqlite:///{DB}", connect_args={"check_same_thread": False})

class Base(DeclarativeBase): pass
class Task(Base):
    __tablename__="tasks"; id: Mapped[int]=mapped_column(primary_key=True); title: Mapped[str]=mapped_column(String(200)); description: Mapped[str]=mapped_column(Text,default=""); priority: Mapped[str]=mapped_column(String(10),default="medium"); due_at: Mapped[Optional[datetime]]=mapped_column(DateTime,nullable=True); status: Mapped[str]=mapped_column(String(12),default="open"); completed_at: Mapped[Optional[datetime]]=mapped_column(DateTime,nullable=True); recurrence: Mapped[str]=mapped_column(String(10),default="none"); recurrence_until: Mapped[Optional[datetime]]=mapped_column(DateTime,nullable=True); source_task_id: Mapped[Optional[int]]=mapped_column(ForeignKey("tasks.id"),nullable=True); is_sample: Mapped[bool]=mapped_column(Boolean,default=False)
class Commitment(Base):
    __tablename__="commitments"; id: Mapped[int]=mapped_column(primary_key=True); title: Mapped[str]=mapped_column(String(200)); kind: Mapped[str]=mapped_column(String(20),default="other"); starts_at: Mapped[datetime]=mapped_column(DateTime); duration_minutes: Mapped[Optional[int]]=mapped_column(Integer,nullable=True); location: Mapped[str]=mapped_column(String(200),default=""); attendees: Mapped[str]=mapped_column(String(500),default=""); notes: Mapped[str]=mapped_column(Text,default=""); status: Mapped[str]=mapped_column(String(12),default="scheduled"); is_sample: Mapped[bool]=mapped_column(Boolean,default=False)
class Contact(Base):
    __tablename__="contacts"; id: Mapped[int]=mapped_column(primary_key=True); name: Mapped[str]=mapped_column(String(160)); email: Mapped[str]=mapped_column(String(200),default=""); phone: Mapped[str]=mapped_column(String(60),default=""); organization: Mapped[str]=mapped_column(String(160),default=""); role: Mapped[str]=mapped_column(String(160),default=""); relationship_context: Mapped[str]=mapped_column(Text,default=""); is_sample: Mapped[bool]=mapped_column(Boolean,default=False)
class Note(Base):
    __tablename__="notes"; id: Mapped[int]=mapped_column(primary_key=True); title: Mapped[str]=mapped_column(String(200),default=""); content: Mapped[str]=mapped_column(Text); kind: Mapped[str]=mapped_column(String(20),default="general"); commitment_id: Mapped[Optional[int]]=mapped_column(ForeignKey("commitments.id"),nullable=True); is_sample: Mapped[bool]=mapped_column(Boolean,default=False)
class Reminder(Base):
    __tablename__="reminders"; id: Mapped[int]=mapped_column(primary_key=True); title: Mapped[str]=mapped_column(String(200)); remind_at: Mapped[datetime]=mapped_column(DateTime); status: Mapped[str]=mapped_column(String(12),default="upcoming"); task_id: Mapped[Optional[int]]=mapped_column(ForeignKey("tasks.id"),nullable=True); commitment_id: Mapped[Optional[int]]=mapped_column(ForeignKey("commitments.id"),nullable=True); is_sample: Mapped[bool]=mapped_column(Boolean,default=False)
class Inbox(Base):
    __tablename__="inbox_items"; id: Mapped[int]=mapped_column(primary_key=True); content: Mapped[str]=mapped_column(Text); status: Mapped[str]=mapped_column(String(12),default="pending"); processed_type: Mapped[Optional[str]]=mapped_column(String(12),nullable=True); processed_id: Mapped[Optional[int]]=mapped_column(Integer,nullable=True); is_sample: Mapped[bool]=mapped_column(Boolean,default=False)

Base.metadata.create_all(engine)
def seed(s: Session):
    if s.scalar(select(Task).limit(1)): return
    now=datetime.now().replace(second=0,microsecond=0)
    s.add_all([Task(title="Review weekly priorities",priority="high",due_at=now+timedelta(hours=3),is_sample=True),Task(title="Send project recap",priority="medium",due_at=now+timedelta(days=1),recurrence="weekly",is_sample=True),Contact(name="Jordan Lee",email="jordan@example.com",organization="Northstar Labs",role="Partner",relationship_context="Primary project contact",is_sample=True)])
    c=Commitment(title="Product planning",kind="meeting",starts_at=now+timedelta(days=1),duration_minutes=45,location="Video call",is_sample=True); s.add(c); s.flush(); s.add_all([Note(title="Planning agenda",content="Review milestones and risks.",kind="preparation",commitment_id=c.id,is_sample=True),Reminder(title="Prepare planning agenda",remind_at=now+timedelta(hours=20),commitment_id=c.id,is_sample=True),Inbox(content="Ask Jordan about launch dates",is_sample=True)]); s.commit()
with Session(engine) as s: seed(s)

app=FastAPI(title="Executive Assistant")
def esc(x): return str(x).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def page(title, body): return HTMLResponse(f"<!doctype html><html><head><title>{esc(title)}</title><link href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css' rel='stylesheet'></head><body class='container py-4'><nav><a href='/'>Dashboard</a> · <a href='/tasks'>Tasks</a> · <a href='/commitments'>Commitments</a> · <a href='/contacts'>Contacts</a> · <a href='/notes'>Notes</a> · <a href='/inbox'>Inbox</a> · <a href='/reminders'>Reminders</a></nav><hr><h1>{esc(title)}</h1>{body}</body></html>")
def form(action, fields): return "<form method='post' action='"+action+"'>"+"".join(f"<div class='mb-2'><label>{label}</label><input class='form-control' name='{name}' value='{value}' {req}></div>" for name,label,value,req in fields)+"<button class='btn btn-primary'>Save</button></form>"
@app.get("/",response_class=HTMLResponse)
def dashboard():
    with Session(engine) as s:
        now=datetime.now(); tasks=s.scalars(select(Task).where(Task.status=="open").order_by(Task.due_at)).all(); cs=s.scalars(select(Commitment).where(Commitment.starts_at>=now,Commitment.starts_at<=now+timedelta(days=7)).order_by(Commitment.starts_at)).all(); ins=s.scalars(select(Inbox).where(Inbox.status=="pending")).all(); rs=s.scalars(select(Reminder).where(Reminder.status.in_(["upcoming","snoozed"])).order_by(Reminder.remind_at)).all()
    body=f"<p>Local time: {now:%Y-%m-%d %H:%M}</p><h2>Open tasks</h2><ul>"+"".join(f"<li>{esc(t.title)} ({t.priority})</li>" for t in tasks)+"</ul><h2>Next 7 days</h2><ul>"+"".join(f"<li>{esc(c.title)} — {c.starts_at:%Y-%m-%d %H:%M}</li>" for c in cs)+f"</ul><p>Pending inbox: {len(ins)} · Active reminders: {len(rs)}</p><p><a class='btn btn-primary' href='/tasks/new'>New task</a> <a class='btn btn-secondary' href='/inbox/new'>Quick capture</a></p>"
    return page("Daily Dashboard",body)
def list_page(kind, rows, new): return page(kind.capitalize(),f"<p><a class='btn btn-primary' href='{new}'>New {kind[:-1]}</a></p><ul>"+"".join(f"<li><a href='/{kind}/{r.id}/edit'>{esc(getattr(r,'title',getattr(r,'name',getattr(r,'content',''))))}</a> {'(sample)' if r.is_sample else ''}</li>" for r in rows)+"</ul>")
@app.get("/tasks",response_class=HTMLResponse)
def tasks():
 with Session(engine) as s:return list_page("tasks",s.scalars(select(Task).order_by(Task.due_at)).all(),"/tasks/new")
@app.get("/tasks/new",response_class=HTMLResponse)
def task_new(): return page("New Task",form("/tasks/new",[("title","Title","", "required"),("priority","Priority","medium", ""),("due_at","Due (YYYY-MM-DD HH:MM)","","")]))
@app.post("/tasks/new")
def task_create(title:str=Form(...),priority:str=Form("medium"),due_at:str=Form("")):
 if priority not in {"low","medium","high"}: raise HTTPException(422,"Invalid priority")
 with Session(engine) as s:s.add(Task(title=title,priority=priority,due_at=datetime.fromisoformat(due_at) if due_at else None));s.commit()
 return RedirectResponse("/tasks",303)
@app.get("/commitments",response_class=HTMLResponse)
def commitments():
 with Session(engine) as s:return list_page("commitments",s.scalars(select(Commitment).order_by(Commitment.starts_at)).all(),"/commitments/new")
@app.get("/contacts",response_class=HTMLResponse)
def contacts():
 with Session(engine) as s:return list_page("contacts",s.scalars(select(Contact).order_by(Contact.name)).all(),"/contacts/new")
@app.get("/notes",response_class=HTMLResponse)
def notes():
 with Session(engine) as s:return list_page("notes",s.scalars(select(Note).order_by(Note.id.desc())).all(),"/notes/new")
@app.get("/inbox",response_class=HTMLResponse)
def inbox():
 with Session(engine) as s:return list_page("inbox",s.scalars(select(Inbox).order_by(Inbox.id.desc())).all(),"/inbox/new")
@app.get("/reminders",response_class=HTMLResponse)
def reminders():
 with Session(engine) as s:return list_page("reminders",s.scalars(select(Reminder).order_by(Reminder.remind_at)).all(),"/reminders")
@app.get("/{kind}/new",response_class=HTMLResponse)
def generic_new(kind:str):
    if kind not in {"commitments","contacts","notes","inbox"}: raise HTTPException(404)
    return page("New "+kind[:-1],form("/"+kind+"/new",[("title","Title","","required"),("content","Content","","")]))
@app.post("/contacts/new")
def contact_create(name:str=Form(...),email:str=Form(""),organization:str=Form("")):
    with Session(engine) as s:s.add(Contact(name=name,email=email,organization=organization));s.commit()
    return RedirectResponse("/contacts",303)
@app.post("/notes/new")
def note_create(content:str=Form(...),title:str=Form("")):
    with Session(engine) as s:s.add(Note(content=content,title=title));s.commit()
    return RedirectResponse("/notes",303)
@app.post("/inbox/new")
def inbox_create(content:str=Form(...)):
    with Session(engine) as s:s.add(Inbox(content=content));s.commit()
    return RedirectResponse("/inbox",303)
@app.post("/commitments/new")
def commitment_create(title:str=Form(...),starts_at:str=Form(...),kind:str=Form("other")):
    try: start=datetime.fromisoformat(starts_at)
    except ValueError: raise HTTPException(422,"A valid start time is required")
    with Session(engine) as s:s.add(Commitment(title=title,starts_at=start,kind=kind));s.commit()
    return RedirectResponse("/commitments",303)
@app.get("/{kind}/{id}/edit",response_class=HTMLResponse)
def generic_edit(kind:str,id:int):
    models={"tasks":Task,"commitments":Commitment,"contacts":Contact,"notes":Note,"reminders":Reminder,"inbox":Inbox}
    cls=models.get(kind)
    if not cls: raise HTTPException(404)
    with Session(engine) as s:
        obj=s.get(cls,id)
        if not obj: raise HTTPException(404)
        label=getattr(obj,"title",getattr(obj,"name",getattr(obj,"content","record")))
    return page("Edit "+kind[:-1],f"<p>{esc(label)}</p><p>Use the feature action controls to update this record.</p>")
@app.post("/{kind}/{id}/edit")
def generic_edit_save(kind:str,id:int, title:str=Form(""), name:str=Form(""), content:str=Form(""), priority:str=Form("medium"), due_at:str=Form(""), starts_at:str=Form(""), email:str=Form(""), organization:str=Form(""), kind_value:str=Form("other")):
    models={"tasks":Task,"commitments":Commitment,"contacts":Contact,"notes":Note,"reminders":Reminder,"inbox":Inbox}; cls=models.get(kind)
    if not cls: raise HTTPException(404)
    values={}
    if cls is Contact: values={"name":name,"email":email,"organization":organization}
    elif cls is Note: values={"title":title,"content":content}
    elif cls is Inbox: values={"content":content}
    elif cls is Task:
        if not title: raise HTTPException(422,"Title is required")
        if priority not in {"low","medium","high"}: raise HTTPException(422,"Invalid priority")
        values={"title":title,"priority":priority,"due_at":datetime.fromisoformat(due_at) if due_at else None}
    elif cls is Commitment:
        if not title or not starts_at: raise HTTPException(422,"Title and start time are required")
        values={"title":title,"starts_at":datetime.fromisoformat(starts_at),"kind":kind_value}
    else: values={"title":title}
    return mutate(cls,id,values)
@app.get("/search",response_class=HTMLResponse)
def search(q:str="",type:str=""):
 with Session(engine) as s:
  out=[]
  for cls,label,col in [(Task,"task",Task.title),(Commitment,"commitment",Commitment.title),(Contact,"contact",Contact.name),(Note,"note",Note.content),(Reminder,"reminder",Reminder.title),(Inbox,"inbox",Inbox.content)]:
   if not type or type==label: out += [(label,x.id,getattr(x,"title",getattr(x,"name",getattr(x,"content","")))) for x in s.scalars(select(cls).where(col.ilike(f"%{q}%"))).all()]
 return page("Search", "<form><input name='q' value='"+esc(q)+"'><button>Search</button></form><ul>"+"".join(f"<li>{a}: {esc(c)}</li>" for a,b,c in out)+"</ul>")

def mutate(model, ident, values):
    with Session(engine) as s:
        obj=s.get(model,ident)
        if not obj: raise HTTPException(404)
        for k,v in values.items():
            if hasattr(obj,k) and v is not None: setattr(obj,k,v)
        s.commit()
    return RedirectResponse(f"/{model.__tablename__.replace('_items','')}",303)

@app.post("/tasks/{id}/complete")
def task_complete(id:int):
    with Session(engine) as s:
        t=s.get(Task,id)
        if not t: raise HTTPException(404)
        t.status="completed"; t.completed_at=datetime.now()
        if t.recurrence!="none":
            delta={"daily":1,"weekly":7,"monthly":30}[t.recurrence]; nxt=(t.due_at or datetime.now())+timedelta(days=delta)
            if not t.recurrence_until or nxt<=t.recurrence_until:s.add(Task(title=t.title,description=t.description,priority=t.priority,due_at=nxt,recurrence=t.recurrence,recurrence_until=t.recurrence_until,source_task_id=t.id))
        s.commit()
    return RedirectResponse("/tasks",303)
@app.post("/tasks/{id}/postpone")
def task_postpone(id:int,due_at:str=Form(...)):
    try: value=datetime.fromisoformat(due_at)
    except ValueError: raise HTTPException(422,"A valid due date is required")
    return mutate(Task,id,{"due_at":value})
@app.post("/commitments/{id}/cancel")
def commitment_cancel(id:int): return mutate(Commitment,id,{"status":"cancelled"})
@app.post("/commitments/{id}/complete")
def commitment_complete(id:int): return mutate(Commitment,id,{"status":"completed"})
@app.post("/reminders/{id}/acknowledge")
def reminder_ack(id:int): return mutate(Reminder,id,{"status":"acknowledged"})
@app.post("/reminders/{id}/dismiss")
def reminder_dismiss(id:int): return mutate(Reminder,id,{"status":"dismissed"})
@app.post("/reminders/{id}/snooze")
def reminder_snooze(id:int,remind_at:str=Form(...)):
    try: value=datetime.fromisoformat(remind_at)
    except ValueError: raise HTTPException(422,"A valid reminder time is required")
    return mutate(Reminder,id,{"status":"snoozed","remind_at":value})
@app.post("/contacts/{id}/delete")
def contact_delete(id:int):
    with Session(engine) as s:
        c=s.get(Contact,id)
        if not c: raise HTTPException(404)
        s.delete(c); s.commit()
    return RedirectResponse("/contacts",303)
@app.post("/inbox/{id}/dismiss")
def inbox_dismiss(id:int): return mutate(Inbox,id,{"status":"dismissed"})
@app.post("/seed/reset")
def seed_reset():
    with Session(engine) as s:
        for cls in (Reminder,Note,Inbox,Commitment,Contact,Task): s.query(cls).filter(cls.is_sample.is_(True)).delete(synchronize_session=False)
        s.commit(); seed(s)
    return RedirectResponse("/",303)
