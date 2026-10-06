export function createListingSearch(database){
 const existing=database.prepare("SELECT 1 FROM sqlite_master WHERE name='listing_search'").get();
 const text=prefix=>`replace(replace(replace(replace(replace(replace(${prefix},'ı','i'),'İ','i'),'æ','ae'),'Æ','ae'),'œ','oe'),'Œ','oe')`;
 database.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS listing_search USING fts5(title,description,tokenize='unicode61 remove_diacritics 2',prefix='2 3 4');
 CREATE VIRTUAL TABLE IF NOT EXISTS listing_search_words USING fts5vocab(listing_search,'row');
 CREATE TRIGGER IF NOT EXISTS listing_search_insert AFTER INSERT ON listings BEGIN
 INSERT INTO listing_search(rowid,title,description) VALUES(new.id,${text('new.title')},${text('new.description')}); END;
 CREATE TRIGGER IF NOT EXISTS listing_search_delete AFTER DELETE ON listings BEGIN DELETE FROM listing_search WHERE rowid=old.id; END;
 CREATE TRIGGER IF NOT EXISTS listing_search_update AFTER UPDATE OF title,description ON listings BEGIN
 DELETE FROM listing_search WHERE rowid=old.id; INSERT INTO listing_search(rowid,title,description) VALUES(new.id,${text('new.title')},${text('new.description')}); END;`);
 if(!existing)database.exec(`INSERT INTO listing_search(rowid,title,description) SELECT id,${text('title')},${text('description')} FROM listings`);
 const expansions=new Map();
 function expression(words,closeWord){
  return words.slice(0,12).map(word=>{
   let alternatives=expansions.get(word);
   if(!alternatives||alternatives.expires<Date.now()){
    // Bound typo expansion work; exact/prefix terms always remain available.
    const length=word.length,limit=/[a-z]/.test(word)?(length>=7?2:length>=4?1:0):0;
    const vocabulary=limit?database.prepare('SELECT term FROM listing_search_words WHERE term>=? AND term<? AND length(term) BETWEEN ? AND ? LIMIT 2048').all(word[0],String.fromCharCode(word.charCodeAt(0)+1),length-limit,length+limit):[];
    alternatives={words:vocabulary.map(row=>row.term).filter(term=>/^[a-z0-9]+$/.test(term)&&term!==word&&closeWord(word,term)).slice(0,24),expires:Date.now()+30000};
    if(expansions.size>=256)expansions.delete(expansions.keys().next().value);expansions.set(word,alternatives);
   }
   return '('+['"'+word+'"*',...alternatives.words.map(term=>'"'+term+'"')].join(' OR ')+')';
  }).join(' AND ');
 }
 return {expression};
}
