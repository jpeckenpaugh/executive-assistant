export class WorkspaceStorage {
  constructor(name = 'executive-assistant') { this.name = name; this.metadata = {revision: 0}; }
  async open() {
    const root = await navigator.storage.getDirectory();
    this.directory = await root.getDirectoryHandle(this.name, {create:true});
    this.file = await this.directory.getFileHandle('workspace.db', {create:true});
    try { this.metadata = {...this.metadata, ...JSON.parse(await (await (await this.directory.getFileHandle('workspace.json')).getFile()).text())}; } catch {}
    const bytes = new Uint8Array(await (await this.file.getFile()).arrayBuffer());
    this.workspaceBytes = bytes.byteLength;
    return bytes;
  }
  async replace(bytes) {
    const writable = await this.file.createWritable();
    try { await writable.write(bytes); await writable.close(); }
    catch (error) { try { await writable.abort(); } catch {} throw error; }
    this.workspaceBytes = bytes.byteLength;
    this.metadata = {...this.metadata, revision:this.metadata.revision + 1, lastPersisted:new Date().toISOString()};
    try { const sidecar = await (await this.directory.getFileHandle('workspace.json',{create:true})).createWritable(); await sidecar.write(JSON.stringify(this.metadata)); await sidecar.close(); } catch {}
  }
  async export() { return (await this.file.getFile()).arrayBuffer(); }
}
