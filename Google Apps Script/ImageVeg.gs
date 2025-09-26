/** Code.gs — Web App ส่งรายการรูปจากโฟลเดอร์ Google Drive เป็น JSON */
function doGet(e) {
  var folderId = (e.parameter.folder || '').trim();
  var recursive = String(e.parameter.recursive || 'false').toLowerCase() === 'true';
  if (!folderId) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Missing folder' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var files = listImages_(folderId, recursive);
    return ContentService.createTextOutput(JSON.stringify({ files: files }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** ดึงรูปจากโฟลเดอร์ (รองรับ recursive ถ้าต้องการ) */
function listImages_(folderId, recursive) {
  var folder = DriveApp.getFolderById(folderId);
  var out = [];

  // รูปในโฟลเดอร์ปัจจุบัน
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var mime = f.getMimeType() || '';
    if (mime.indexOf('image/') !== 0) continue;
    var id = f.getId();
    out.push({
      id: id,
      mimeType: mime,
      // ชี้พรีวิว & ไฟล์เต็มด้วยลิงก์มาตรฐานของ Drive (โหลดไว/เสถียร)
      thumbnail: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600',
      view: 'https://drive.google.com/uc?export=view&id=' + id,
      modifiedTime: f.getLastUpdated()
    });
  }

  // รูปในโฟลเดอร์ย่อย (หากเปิด recursive)
  if (recursive) {
    var subs = folder.getFolders();
    while (subs.hasNext()) {
      var sub = subs.next();
      out = out.concat(listImages_(sub.getId(), true));
    }
  }
  return out;
}
