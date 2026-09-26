import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const email = (process.argv[2] || '').trim().toLowerCase();
if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Kullanım: npm run admin:grant -- kullanici@ornek.com');
  process.exit(1);
}
const databasePath = path.join(process.env.DATA_DIR || path.join(root, 'data'), 'unipazar.sqlite');
if (!fs.existsSync(databasePath)) {
  console.error('Veritabanı bulunamadı. Önce uygulamayı başlatıp hesabı oluştur.');
  process.exit(1);
}
const db = new DatabaseSync(databasePath);
try {
  const user = db.prepare('SELECT id,role FROM users WHERE lower(email)=?').get(email);
  if (!user) {
    console.error('Bu e-posta adresiyle kayıtlı hesap bulunamadı.');
    process.exitCode = 1;
  } else if (user.role === 'admin') {
    console.log('Bu hesap zaten yönetici.');
  } else if (db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
    console.error('Zaten bir yönetici hesabı var. İkinci bir yönetici atanamaz.');
    process.exitCode = 1;
  } else if (db.prepare('SELECT closed_at FROM users WHERE id=?').get(user.id)?.closed_at) {
    console.error('Kapatılmış hesap yönetici yapılamaz.');
    process.exitCode = 1;
  } else {
    db.prepare("UPDATE users SET role='admin', student_status='approved' WHERE id=?").run(user.id);
    console.log('Yönetici yetkisi verildi. Açık sayfayı yenileyerek Yönetim ekranına gir.');
  }
} finally {
  db.close();
}
