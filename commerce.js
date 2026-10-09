// Checkout preparation only. No HTTP route can claim or confirm a payment.
export function registerCommerce({app,db,requireUser,fail,requireVerifiedSeller=()=>true}) {
  db.exec(`CREATE TABLE IF NOT EXISTS checkout_drafts (
    id INTEGER PRIMARY KEY, buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    delivery TEXT NOT NULL CHECK(delivery IN ('campus','shipping')),
    snapshot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS checkout_one_draft ON checkout_drafts(buyer_id,listing_id) WHERE status='draft';
    CREATE INDEX IF NOT EXISTS checkout_buyer_recent ON checkout_drafts(buyer_id,id DESC);`);
  const configuration={paymentAvailable:false,shippingAvailable:false,sellerType:'private',
    notice:'Sipariş hazırlığı kullanılabilir. Uygulama üzerinden ödeme ve kargo hizmeti henüz etkin değildir. Taslak oluşturmak ürünü ayırmaz veya satıcıya sipariş göndermez.',
    supportEmail:'unisatis06@gmail.com'};
  const present=row=>({id:row.id,listingId:row.listing_id,delivery:row.delivery,status:row.status,createdAt:row.created_at,snapshot:JSON.parse(row.snapshot)});
  app.get('/api/commerce/config',(_req,res)=>res.json({...configuration,sellerPhoneVerificationRequired:requireVerifiedSeller()}));
  app.get('/api/commerce/drafts',(req,res)=>{
    const user=requireUser(req,res);if(!user)return;
    res.set('Cache-Control','no-store').json({drafts:db.prepare('SELECT * FROM checkout_drafts WHERE buyer_id=? ORDER BY id DESC LIMIT 100').all(user.id).map(present)});
  });
  app.post('/api/commerce/drafts',(req,res)=>{
    const user=requireUser(req,res);if(!user)return;
    const {listingId,delivery}=req.body||{};
    if(!Number.isSafeInteger(listingId)||listingId<1||!['campus','shipping'].includes(delivery))return fail(res,400,'Geçerli ilan ve teslimat tercihi seç.');
    const listing=db.prepare(`SELECT l.*,u.name AS seller_name,u.closed_at,u.phone_verified FROM listings l JOIN users u ON u.id=l.seller_id WHERE l.id=?`).get(listingId);
    if(!listing||listing.closed_at||listing.kind!=='sale')return fail(res,404,'Satış ilanı bulunamadı.');
    if(listing.seller_id===user.id)return fail(res,400,'Kendi ilanına sipariş hazırlayamazsın.');
    if(listing.status!=='active')return fail(res,409,'Bu ilan şu anda satışa açık değil.');
    if(requireVerifiedSeller()&&!listing.phone_verified)return fail(res,403,'Satıcının telefon doğrulaması tamamlanmadan alışveriş başlatılamaz.');
    if(db.prepare('SELECT 1 FROM blocked_users WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').get(user.id,listing.seller_id,listing.seller_id,user.id))return fail(res,403,'Bu kullanıcıyla işlem yapılamıyor.');
    const previous=db.prepare("SELECT id FROM checkout_drafts WHERE buyer_id=? AND listing_id=? AND status='draft'").get(user.id,listingId);
    if(!previous&&db.prepare("SELECT COUNT(*) AS count FROM checkout_drafts WHERE buyer_id=? AND status='draft'").get(user.id).count>=20)return fail(res,409,'En fazla 20 açık taslak saklayabilirsin.');
    const snapshot=JSON.stringify({title:listing.title,description:listing.description,condition:listing.condition,price:listing.price,university:listing.university,sellerName:listing.seller_name,shippingFee:null,serviceFee:null,total:null,currency:'TRY'});
    // Prices are read from the server; client supplied price/payment fields are ignored.
    const result=db.prepare(`INSERT INTO checkout_drafts(buyer_id,listing_id,delivery,snapshot) VALUES(?,?,?,?)
      ON CONFLICT(buyer_id,listing_id) WHERE status='draft' DO UPDATE SET delivery=excluded.delivery,snapshot=excluded.snapshot RETURNING *`).get(user.id,listingId,delivery,snapshot);
    res.status(previous?200:201).json({draft:present(result),configuration});
  });
  app.delete('/api/commerce/drafts/:id',(req,res)=>{
    const user=requireUser(req,res);if(!user)return;
    const result=db.prepare('DELETE FROM checkout_drafts WHERE id=? AND buyer_id=?').run(req.params.id,user.id);
    if(!result.changes)return fail(res,404,'Taslak bulunamadı.');
    res.json({deleted:true});
  });
  app.post('/api/commerce/drafts/:id/pay',(req,res)=>{
    const user=requireUser(req,res);if(!user)return;
    if(!db.prepare('SELECT 1 FROM checkout_drafts WHERE id=? AND buyer_id=?').get(req.params.id,user.id))return fail(res,404,'Taslak bulunamadı.');
    return fail(res,503,'Ödeme kuruluşu bağlantısı henüz tamamlanmadı. Para alınmadı.');
  });
}
