export function cachePreparedStatements(database,limit=256){
 const prepare=database.prepare.bind(database),statements=new Map();
 database.prepare=sql=>{
  if(statements.has(sql)){const statement=statements.get(sql);statements.delete(sql);statements.set(sql,statement);return statement;}
  const statement=prepare(sql);if(statements.size>=limit)statements.delete(statements.keys().next().value);statements.set(sql,statement);return statement;
 };
 return database;
}

export function addPerformanceIndexes(database){
 database.exec(`
 CREATE INDEX IF NOT EXISTS listing_images_cover ON listing_images(listing_id,position);
 CREATE INDEX IF NOT EXISTS listings_expiry ON listings(status,created_at);
 CREATE INDEX IF NOT EXISTS listings_active_id ON listings(status,kind,id DESC);
 CREATE INDEX IF NOT EXISTS listings_university_id ON listings(university,status,kind,id DESC);
 CREATE INDEX IF NOT EXISTS listings_seller_recent ON listings(seller_id,created_at DESC);
 CREATE INDEX IF NOT EXISTS conversations_buyer ON conversations(buyer_id,id);
 CREATE INDEX IF NOT EXISTS conversations_seller ON conversations(seller_id,id);
 CREATE INDEX IF NOT EXISTS messages_unread_conversation ON messages(conversation_id,sender_id) WHERE read_at IS NULL;
 CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
 CREATE INDEX IF NOT EXISTS messages_sender ON messages(sender_id);
 CREATE INDEX IF NOT EXISTS listing_images_filename ON listing_images(filename);
 `);
}
