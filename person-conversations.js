// Existing threads retain their IDs and listing links; history is presented by person.
export function groupConversationRows(rows) {
  const groups=new Map();
  for(const row of rows){
    let group=groups.get(row.other_id);
    if(!group){group={...row,conversationIds:[],unread_count:0};groups.set(row.other_id,group);}
    group.conversationIds.push(row.id);group.id=Math.min(group.id,row.id);group.unread_count+=row.unread_count||0;
    if(!group.last_message&&row.last_message){group.last_message=row.last_message;group.last_at=row.last_at;}
  }
  return [...groups.values()];
}
export function personThreadIds(db,conversation,user) {
  return db.prepare(`SELECT c.id FROM conversations c LEFT JOIN listings l ON l.id=c.listing_id
    WHERE ((c.buyer_id=? AND c.seller_id=?) OR (c.buyer_id=? AND c.seller_id=?))
    AND (c.listing_id IS NULL OR l.kind='sale' OR ?=1 OR l.seller_id=?) ORDER BY c.id`).all(
      conversation.buyer_id,conversation.seller_id,conversation.seller_id,conversation.buyer_id,user.support_verified||0,user.id).map(row=>row.id);
}
