import {validateBackup,restoreBackup} from '../operations.js';
const [folder,target]=process.argv.slice(2);
if(!folder){console.error('Kullanım: node scripts/restore-backup.mjs YEDEK_DIZINI [YENI_HEDEF_DIZINI]');process.exit(1);}
try{console.log(JSON.stringify(target?await restoreBackup(folder,target):await validateBackup(folder),null,2));}catch(error){console.error(error.message);process.exit(1);}
