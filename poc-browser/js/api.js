import {db} from './db/client.js';
export const init = () => db.call('workspace.init');
export const workspace = { status:() => db.call('workspace.status'), reset:() => db.call('workspace.reset'), export:() => db.call('workspace.export'), import:(bytes) => db.call('workspace.import',{bytes}) };
export const dashboard = () => db.call('dashboard.get');
export const list = (type, filters={}) => db.call('records.list',{type,filters});
export const get = (type,id) => db.call('records.get',{type,id:Number(id)});
export const save = (type,id,data) => db.call('records.save',{type,id:id ? Number(id) : null,data});
export const action = (type,id,name,data={}) => db.call('records.action',{type,id:Number(id),name,data});
export const search = (q,type) => db.call('search',{q,type});
