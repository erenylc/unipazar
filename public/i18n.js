import {extraRows} from './i18n-extra.js';
export const languages={tr:'🇹🇷 Türkçe',en:'🇬🇧 English',es:'🇪🇸 Español',kk:'🇰🇿 Қазақша',de:'🇩🇪 Deutsch',fr:'🇫🇷 Français'};
const rows={
'Keşfet':['Explore','Explorar','Қарау','Entdecken','Explorer'],
'Favoriler':['Favorites','Favoritos','Таңдаулылар','Favoriten','Favoris'],
'Mesajlarım':['My messages','Mis mensajes','Хабарларым','Meine Nachrichten','Mes messages'],
'Mesajlar':['Messages','Mensajes','Хабарлар','Nachrichten','Messages'],
'İlanlarım':['My listings','Mis anuncios','Хабарландыруларым','Meine Anzeigen','Mes annonces'],
'Yönetim':['Admin','Administración','Басқару','Verwaltung','Administration'],
'Destek':['Support','Soporte','Қолдау','Hilfe','Assistance'],
'İlan ver':['Post listing','Publicar anuncio','Хабарландыру беру','Anzeige aufgeben','Publier une annonce'],
'Hesabım':['My account','Mi cuenta','Менің аккаунтым','Mein Konto','Mon compte'],
'Hesaptan çıkış yap':['Sign out','Cerrar sesión','Шығу','Abmelden','Se déconnecter'],
'Dil':['Language','Idioma','Тіл','Sprache','Langue'],
'Üniversitende neler var?':['What is on your campus?','¿Qué hay en tu universidad?','Университетте не бар?','Was gibt es auf deinem Campus?','Que trouve-t-on sur ton campus ?'],
'Öğrencilerin yeni eklediği ilanlar':['Recently posted by students','Anuncios recientes de estudiantes','Студенттердің жаңа хабарландырулары','Neue Anzeigen von Studierenden','Annonces récentes des étudiants'],
'Tüm kategoriler':['All categories','Todas las categorías','Барлық санаттар','Alle Kategorien','Toutes les catégories'],
'Üniversite seç:':['Choose university:','Elige universidad:','Университет таңдаңыз:','Universität wählen:','Choisir une université :'],
'Üniversite seç':['Choose university','Elegir universidad','Университет таңдау','Universität wählen','Choisir une université'],
'Eşyalar el değiştirir, iyilik büyür.':['Things change hands, kindness grows.','Las cosas cambian de manos, la bondad crece.','Заттар қол ауыстырады, жақсылық көбейеді.','Dinge wechseln den Besitzer, Freundlichkeit wächst.','Les objets changent de mains, la solidarité grandit.'],
'İlanı incele':['View listing','Ver anuncio','Хабарландыруды көру','Anzeige ansehen','Voir l’annonce'],
'İkinci el':['Secondhand','Segunda mano','Қолданылған','Gebraucht','Occasion'],
'Dayanışma':['Community','Solidaridad','Қолдау','Gemeinschaft','Solidarité'],
'Ücretsiz':['Free','Gratis','Тегін','Kostenlos','Gratuit'],
'Satıcıya özel mesaj yaz':['Message seller','Enviar mensaje al vendedor','Сатушыға жазу','Verkäufer anschreiben','Écrire au vendeur'],
'Gönder':['Send','Enviar','Жіберу','Senden','Envoyer'],
'Bir konuşma seç':['Select a conversation','Selecciona una conversación','Сөйлесуді таңдаңыз','Unterhaltung auswählen','Choisir une conversation'],
'Yazışmalarını görmek için soldan bir kişiye tıkla.':['Choose someone on the left to see your messages.','Elige a alguien a la izquierda para ver tus mensajes.','Хабарларды көру үшін сол жақтан адамды таңдаңыз.','Wähle links eine Person, um deine Nachrichten zu sehen.','Choisissez une personne à gauche pour voir vos messages.'],
'Henüz konuşman yok':['No conversations yet','Aún no hay conversaciones','Әзірге сөйлесулер жоқ','Noch keine Unterhaltungen','Aucune conversation pour le moment'],
'İlk mesajı yaz.':['Write the first message.','Escribe el primer mensaje.','Алғашқы хабарды жазыңыз.','Schreibe die erste Nachricht.','Écrivez le premier message.'],
'Sesli mesaj kaydet':['Record voice message','Grabar mensaje de voz','Дауыстық хабар жазу','Sprachnachricht aufnehmen','Enregistrer un message vocal'],
'Fotoğraf çek veya galeriden seç':['Take a photo or choose from gallery','Tomar una foto o elegir de la galería','Фото түсіру немесе галереядан таңдау','Foto aufnehmen oder aus Galerie wählen','Prendre une photo ou choisir dans la galerie'],
'İlanlara dön':['Back to listings','Volver a los anuncios','Хабарландыруларға қайту','Zurück zu Anzeigen','Retour aux annonces'],
'Ürün açıklaması':['Product description','Descripción del producto','Өнім сипаттамасы','Produktbeschreibung','Description du produit'],
'İlanı düzenle':['Edit listing','Editar anuncio','Хабарландыруды өңдеу','Anzeige bearbeiten','Modifier l’annonce'],
'İlanı bildir':['Report listing','Denunciar anuncio','Хабарландыруға шағым','Anzeige melden','Signaler l’annonce'],
'♡ Favorilere ekle':['♡ Add to favorites','♡ Añadir a favoritos','♡ Таңдаулыларға қосу','♡ Zu Favoriten hinzufügen','♡ Ajouter aux favoris'],
'Yeni ilan ver':['New listing','Nuevo anuncio','Жаңа хабарландыру','Neue Anzeige','Nouvelle annonce'],
'Ürün adı':['Product name','Nombre del producto','Өнім атауы','Produktname','Nom du produit'],
'Kategori':['Category','Categoría','Санат','Kategorie','Catégorie'],
'Durumu':['Condition','Estado','Күйі','Zustand','État'],
'Fiyat (₺)':['Price (₺)','Precio (₺)','Бағасы (₺)','Preis (₺)','Prix (₺)'],
'Açıklama':['Description','Descripción','Сипаттама','Beschreibung','Description'],
'Fotoğraflar':['Photos','Fotos','Фотосуреттер','Fotos','Photos'],
'Fotoğraf ekle':['Add photos','Añadir fotos','Фото қосу','Fotos hinzufügen','Ajouter des photos'],
'Henüz fotoğraf seçilmedi':['No photos selected','No se seleccionaron fotos','Фото таңдалмады','Keine Fotos ausgewählt','Aucune photo sélectionnée'],
'İlanı yayınla':['Publish listing','Publicar anuncio','Хабарландыруды жариялау','Anzeige veröffentlichen','Publier l’annonce'],
'Vazgeç':['Cancel','Cancelar','Бас тарту','Abbrechen','Annuler'],
'Hesaplar':['Accounts','Cuentas','Аккаунттар','Konten','Comptes'],
'Şikâyetler':['Reports','Denuncias','Шағымдар','Meldungen','Signalements'],
'Hesabı kapat':['Close account','Cerrar cuenta','Аккаунтты жабу','Konto schließen','Fermer le compte'],
'Konuşmaları incele':['Review conversations','Revisar conversaciones','Сөйлесулерді қарау','Unterhaltungen prüfen','Examiner les conversations'],
'Kişisel bilgileri kaydet':['Save personal details','Guardar datos personales','Жеке деректерді сақтау','Persönliche Daten speichern','Enregistrer les informations'],
'Giriş yap':['Sign in','Iniciar sesión','Кіру','Anmelden','Se connecter'],
'Kayıt ol':['Register','Registrarse','Тіркелу','Registrieren','S’inscrire'],
'E-posta':['Email','Correo electrónico','Электрондық пошта','E-Mail','E-mail'],
'Şifre':['Password','Contraseña','Құпия сөз','Passwort','Mot de passe']
,'＋ İlan ver':['＋ Post listing','＋ Publicar anuncio','＋ Хабарландыру беру','＋ Anzeige aufgeben','＋ Publier une annonce']
,'Ürün hakkında konuş, fotoğraf paylaş, ayrıntıları birlikte netleştir.':['Discuss the item, share photos, and agree on details.','Habla del producto, comparte fotos y acuerda los detalles.','Өнімді талқылап, фото бөлісіп, мәліметтерді нақтылаңыз.','Besprich den Artikel, teile Fotos und kläre Details.','Parlez du produit, partagez des photos et précisez les détails.']
,'Ürün, kitap, marka ara...':['Search products, books, brands...','Buscar productos, libros, marcas...','Өнім, кітап, бренд іздеу...','Produkte, Bücher, Marken suchen...','Rechercher produits, livres, marques...']
,'Özel mesaj yaz...':['Write a private message...','Escribe un mensaje privado...','Жеке хабар жазыңыз...','Private Nachricht schreiben...','Écrire un message privé...']
,'Üniversitende ikinci el alışveriş yap; kullanmadıklarını ihtiyacı olan öğrencilere ücretsiz ver.':['Buy and sell secondhand on campus; give unused items to students in need.','Compra y vende de segunda mano en tu universidad; regala lo que no uses.','Университетте қолданылған заттарды сатып алыңыз және қажет ететіндерге сыйлаңыз.','Kaufe und verkaufe Gebrauchtes auf dem Campus; verschenke ungenutzte Dinge.','Achetez et vendez d’occasion sur le campus ; donnez les objets inutilisés.']
,'İlan ver →':['Post listing →','Publicar anuncio →','Хабарландыру беру →','Anzeige aufgeben →','Publier une annonce →']
,'Ücretsiz ürün ver →':['Give away an item →','Regalar un artículo →','Тегін зат беру →','Artikel verschenken →','Donner un objet →']
,'Dayanışma da üniversitenin bir parçası.':['Community is part of campus life.','La solidaridad es parte de la universidad.','Қолдау да университет өмірінің бір бөлігі.','Gemeinschaft gehört zum Campusleben.','La solidarité fait partie de la vie universitaire.']
,'Kullanmadığın bir eşya başka bir öğrencinin ihtiyacını karşılayabilir.':['An item you no longer use could help another student.','Un objeto que no usas puede ayudar a otro estudiante.','Қолданбайтын затыңыз басқа студентке көмектесе алады.','Ein ungenutzter Gegenstand kann anderen Studierenden helfen.','Un objet inutilisé peut aider un autre étudiant.']
,'Favorilerim':['My favorites','Mis favoritos','Таңдаулыларым','Meine Favoriten','Mes favoris']
,'Kaydettiğin ilanlar burada.':['Your saved listings are here.','Tus anuncios guardados están aquí.','Сақталған хабарландыруларыңыз осында.','Deine gespeicherten Anzeigen sind hier.','Vos annonces enregistrées sont ici.']
,'Henüz favorin yok':['No favorites yet','Aún no tienes favoritos','Әзірге таңдаулылар жоқ','Noch keine Favoriten','Aucun favori pour le moment']
,'Beğendiğin ilanları kalp simgesiyle kaydet.':['Save listings you like with the heart icon.','Guarda los anuncios que te gusten con el corazón.','Ұнаған хабарландыруларды жүрекпен сақтаңыз.','Speichere Anzeigen mit dem Herzsymbol.','Enregistrez vos annonces préférées avec le cœur.']
,'Satışlarını ve Dayanışma taleplerini buradan yönet.':['Manage your listings and community requests here.','Gestiona tus anuncios y solicitudes aquí.','Хабарландыруларыңыз бен өтініштеріңізді осында басқарыңыз.','Verwalte hier deine Anzeigen und Anfragen.','Gérez vos annonces et demandes ici.']
,'Henüz ilan vermedin':['No listings yet','Aún no has publicado anuncios','Әзірге хабарландыру жоқ','Noch keine Anzeigen','Aucune annonce pour le moment']
,'İlk ilanını vererek başlayabilirsin.':['Post your first listing to get started.','Publica tu primer anuncio para empezar.','Бастау үшін алғашқы хабарландыруды беріңіз.','Starte mit deiner ersten Anzeige.','Commencez par publier votre première annonce.']
,'İlanı yayınla':['Publish listing','Publicar anuncio','Хабарландыруды жариялау','Anzeige veröffentlichen','Publier l’annonce']
,'İkinci el satış':['Secondhand sale','Venta de segunda mano','Қолданылған зат сату','Gebrauchtverkauf','Vente d’occasion']
,'Kategori seç':['Choose category','Elegir categoría','Санат таңдаңыз','Kategorie wählen','Choisir une catégorie']
,'Durum seç':['Choose condition','Elegir estado','Күйін таңдаңыз','Zustand wählen','Choisir l’état']
,'Yeni':['New','Nuevo','Жаңа','Neu','Neuf']
,'Az kullanılmış':['Lightly used','Poco usado','Аз қолданылған','Wenig benutzt','Peu utilisé']
,'Kullanılmış':['Used','Usado','Қолданылған','Gebraucht','Utilisé']
,'Onarım gerektirir':['Needs repair','Necesita reparación','Жөндеу қажет','Reparaturbedürftig','À réparer']
,'Kaydet':['Save','Guardar','Сақтау','Speichern','Enregistrer']
,'Kapat':['Close','Cerrar','Жабу','Schließen','Fermer']
,'Düzenle':['Edit','Editar','Өңдеу','Bearbeiten','Modifier']
,'Kaldır':['Remove','Eliminar','Алып тастау','Entfernen','Retirer']
,'Yayında':['Published','Publicado','Жарияланған','Veröffentlicht','Publiée']
,'Tamamlandı':['Completed','Completado','Аяқталды','Abgeschlossen','Terminée']
,'Üniversite':['University','Universidad','Университет','Universität','Université']
,'Ad ve soyad':['Full name','Nombre completo','Аты-жөні','Vollständiger Name','Nom complet']
,'Telefon numarası':['Phone number','Número de teléfono','Телефон нөмірі','Telefonnummer','Numéro de téléphone']
,'Destek başvurusu':['Support application','Solicitud de apoyo','Қолдау өтініші','Hilfeantrag','Demande d’aide']
,'Başvuruyu gönder':['Submit application','Enviar solicitud','Өтініш жіберу','Antrag senden','Envoyer la demande']
,'Başvuruyu güncelle':['Update application','Actualizar solicitud','Өтінішті жаңарту','Antrag aktualisieren','Mettre à jour la demande']
,'Hesap ara':['Search accounts','Buscar cuentas','Аккаунт іздеу','Konten suchen','Rechercher des comptes']
,'Karanlık moda geç':['Switch to dark mode','Cambiar a modo oscuro','Қараңғы режим','Dunkelmodus aktivieren','Passer en mode sombre']
,'Açık moda geç':['Switch to light mode','Cambiar a modo claro','Жарық режим','Hellmodus aktivieren','Passer en mode clair']
,'Karanlık mod':['Dark mode','Modo oscuro','Қараңғы режим','Dunkelmodus','Mode sombre']
,'Açık mod':['Light mode','Modo claro','Жарық режим','Hellmodus','Mode clair']
,'Şikâyetlerde yönetici, gerekçesini kaydederek konuşmayı inceleyebilir.':['For complaints, an administrator may review the conversation with a logged reason.','En caso de denuncia, un administrador puede revisar la conversación y registrar el motivo.','Шағым кезінде әкімші себебін тіркеп, сөйлесуді қарай алады.','Bei Beschwerden kann die Verwaltung die Unterhaltung mit protokollierter Begründung prüfen.','En cas de signalement, un administrateur peut examiner la conversation avec un motif enregistré.']
,...extraRows
};
const codes=['en','es','kk','de','fr'];
export function translateText(raw,language){
 if(language==='tr')return raw;
 const index=codes.indexOf(language);if(index<0)return raw;
 const exact=rows[raw];if(exact)return exact[index];
 const listing=raw.match(/^(\d+) ilan$/);
 if(listing){const n=Number(listing[1]);return `${n} ${[n===1?'listing':'listings',n===1?'anuncio':'anuncios',n===1?'хабарландыру':'хабарландыру',n===1?'Anzeige':'Anzeigen',n===1?'annonce':'annonces'][index]}`;}
 const photos=raw.match(/^(\d+)(\/6)? fotoğraf(?: seçildi)?$/);
 if(photos)return `${photos[1]}${photos[2]||''} ${['photos','fotos','фото','Fotos','photos'][index]}`;
 const numberedPhoto=raw.match(/^(\d+)\. fotoğraf$/);
 if(numberedPhoto)return `${numberedPhoto[1]}. ${['photo','foto','фото','Foto','photo'][index]}`;
 const sellChoice=raw.match(/^(.+) öğrencileri için bir seçenek seç\.$/);
 if(sellChoice)return [`Choose an option for students at ${sellChoice[1]}.`,`Elige una opción para estudiantes de ${sellChoice[1]}.`,`${sellChoice[1]} студенттері үшін нұсқаны таңдаңыз.`,`Wähle eine Option für Studierende an der ${sellChoice[1]}.`,`Choisissez une option pour les étudiants de ${sellChoice[1]}.`][index];
 const listingState=raw.match(/^Bu ilan şu an (.+)\.$/);
 if(listingState)return [`This listing is currently ${listingState[1]}.`,`Este anuncio está actualmente ${listingState[1]}.`,`Бұл хабарландыру қазір ${listingState[1]}.`,`Diese Anzeige ist derzeit ${listingState[1]}.`,`Cette annonce est actuellement ${listingState[1]}.`][index];
 const sellerProfile=raw.match(/^(.+) adlı öğrencinin profili$/);
 if(sellerProfile)return [`${sellerProfile[1]}'s profile`,`Perfil de ${sellerProfile[1]}`,`${sellerProfile[1]} профилі`,`Profil von ${sellerProfile[1]}`,`Profil de ${sellerProfile[1]}`][index];
 const messages=raw.match(/^(\d+) mesaj$/);
 if(messages)return `${messages[1]} ${[Number(messages[1])===1?'message':'messages',Number(messages[1])===1?'mensaje':'mensajes','хабар',Number(messages[1])===1?'Nachricht':'Nachrichten',Number(messages[1])===1?'message':'messages'][index]}`;
 const supportCount=raw.match(/^Destek başvuruları \((\d+)\)$/);
 if(supportCount)return `${['Support applications','Solicitudes de apoyo','Қолдау өтініштері','Hilfeanträge','Demandes d’aide'][index]} (${supportCount[1]})`;
 const reportCount=raw.match(/^Şikâyetler \((\d+)\)$/);
 if(reportCount)return `${['Reports','Denuncias','Шағымдар','Meldungen','Signalements'][index]} (${reportCount[1]})`;
 const accountCount=raw.match(/^Toplam (\d+) hesap · (\d+) açık hesap$/);
 if(accountCount){const [all,active]=accountCount.slice(1).map(Number);return [`${all} ${all===1?'account':'accounts'} · ${active} active`,`${all} ${all===1?'cuenta':'cuentas'} · ${active} ${active===1?'activa':'activas'}`,`${all} аккаунт · ${active} ашық`,`${all} ${all===1?'Konto':'Konten'} · ${active} aktiv`,`${all} ${all===1?'compte':'comptes'} · ${active} ${active===1?'actif':'actifs'}`][index];}
 const mine=raw.match(/^(.+) için verdiğin ilanlar\.$/);
 if(mine)return [`Your listings at ${mine[1]}.`,`Tus anuncios en ${mine[1]}.`,`${mine[1]} бойынша хабарландыруларыңыз.`,`Deine Anzeigen an der ${mine[1]}.`,`Vos annonces à ${mine[1]}.`][index];
 if(raw.includes(' · ')){
  const parts=raw.split(' · '),translated=parts.map(part=>translateText(part,language));
  if(translated.some((part,i)=>part!==parts[i]))return translated.join(' · ');
 }
 const labeled=raw.match(/^(.+?): (.+)$/);
 if(labeled){const label=translateText(labeled[1],language),value=translateText(labeled[2],language);if(label!==labeled[1]||value!==labeled[2])return `${label}: ${value}`;}
 const emailStatus=raw.match(/^E-posta (doğrulandı|doğrulanmadı)$/);
 if(emailStatus)return `${translateText('E-posta',language)} ${translateText(emailStatus[1],language)}`;
 return raw;
}
export function applyLocale(root,language){
 document.documentElement.lang=language;
 document.title=`Üni Satış — ${translateText('Üniversitenin pazarı',language)}`;
 if(language==='tr')return;
 const index=codes.indexOf(language);if(index<0)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){
  if(node.parentElement?.closest('.bubble,.chat-last,.chat-context,.card-body h3,.profile-summary,.admin-review-message'))continue;
  const raw=node.nodeValue,trim=raw.trim(),translation=translateText(trim,language);
  if(translation!==trim)node.nodeValue=raw.replace(trim,translation);
 }
 root.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(element=>{
  for(const attribute of ['placeholder','aria-label','title','alt']){const value=element.getAttribute(attribute);if(value)element.setAttribute(attribute,translateText(value,language));}
 });
}
