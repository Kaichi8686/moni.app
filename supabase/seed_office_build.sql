-- seed office build masters (generated)
-- 冪等 upsert

insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'organize_ticket','整理券','rotation',1,ARRAY['ops','queue']::text[],'{"customers":20}'::jsonb,'待ちを整え、客数+20','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'student_discount','学割','target',1,ARRAY['price','youth']::text[],'{"customers":30}'::jsonb,'学生向け値引きで客数+30','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'set_deal','セット割','set_sales',1,ARRAY['price','bundle']::text[],'{"price":100}'::jsonb,'セットにして客単価+100','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'smile_service','笑顔接客','repeat',1,ARRAY['service','mood']::text[],'{"customers":15}'::jsonb,'雰囲気アップで客数+15','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'limited_poster','限定ポスター','scarcity',1,ARRAY['promo','scarcity']::text[],'{"customers":25}'::jsonb,'期間限定感で客数+25','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'upsell_drink','追加ドリンク','unit_price',1,ARRAY['price','upsell']::text[],'{"price":80}'::jsonb,'ついで買いを促し単価+80','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'quick_clean','サッと清掃','rotation',1,ARRAY['ops','space']::text[],'{"customers":10,"mult":1.05}'::jsonb,'席回転アップ','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'word_of_mouth','口コミお願い','wom',2,ARRAY['promo','sns']::text[],'{"customers":40}'::jsonb,'紹介を増やし客数+40','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'premium_topping','プレミアムトッピング','unit_price',2,ARRAY['price','quality']::text[],'{"price":150}'::jsonb,'単価+150','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'flash_sale','タイムセール','scarcity',2,ARRAY['price','scarcity','promo']::text[],'{"customers":50,"price":-30}'::jsonb,'客は増えるが単価はやや下がる','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'staff_brief','朝礼ショート','ops',1,ARRAY['ops','team']::text[],'{"mult":1.1}'::jsonb,'チーム連携で倍率×1.1','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'loyalty_stamp','スタンプカード','repeat',2,ARRAY['service','repeat']::text[],'{"customers":20,"mult":1.08}'::jsonb,'リピート誘導','common',1
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'influencer_visit','インスタ依頼','wom',3,ARRAY['sns','promo']::text[],'{"customers":80}'::jsonb,'拡散で客数+80','rare',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'course_menu','コースメニュー','set_sales',2,ARRAY['bundle','price']::text[],'{"price":200}'::jsonb,'単価+200','rare',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'night_hours','延長営業','rotation',2,ARRAY['ops','hours']::text[],'{"customers":35}'::jsonb,'夜の客数+35','rare',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'cost_cut_pack','仕入れ見直し','cost',1,ARRAY['cost','ops']::text[],'{"mult":1.12}'::jsonb,'原価を抑え倍率×1.12','rare',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'vip_room','VIP席','unit_price',3,ARRAY['price','vip']::text[],'{"price":300,"customers":-10}'::jsonb,'単価大幅アップ','rare',3
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'collab_goods','コラボグッズ','diff',2,ARRAY['promo','diff']::text[],'{"customers":30,"price":50}'::jsonb,'差別化で客と単価','rare',3
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'rain_cover','雨の日クーポン','target',1,ARRAY['weather','price','youth']::text[],'{"customers":45}'::jsonb,'雨の来店を増やす','rare',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'queue_app','順番待ちアプリ','rotation',2,ARRAY['ops','queue','tech']::text[],'{"customers":40,"mult":1.05}'::jsonb,'待ちストレス減','rare',3
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'taste_test','試食コーナー','unit_price',1,ARRAY['service','upsell']::text[],'{"price":60,"customers":10}'::jsonb,'試して買う流れ','common',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'member_price','会員価格','repeat',2,ARRAY['price','repeat','youth']::text[],'{"customers":55}'::jsonb,'会員で客数+55','rare',3
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'story_sign','こだわり看板','diff',1,ARRAY['diff','promo']::text[],'{"mult":1.15}'::jsonb,'世界観で倍率×1.15','rare',3
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'bundle_3','3点セット','set_sales',2,ARRAY['bundle','price']::text[],'{"price":120,"customers":15}'::jsonb,'まとめ買いで単価と客','common',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'peak_staff','ピーク増員','ops',3,ARRAY['ops','team','queue']::text[],'{"customers":60}'::jsonb,'混雑をさばく','epic',4
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'secret_menu','裏メニュー','diff',2,ARRAY['diff','scarcity','sns']::text[],'{"price":180,"mult":1.1}'::jsonb,'知る人ぞ知る単価','epic',4
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'community_night','交流ナイト','wom',3,ARRAY['community','promo','mood']::text[],'{"customers":70}'::jsonb,'地域の人を呼ぶ','epic',4
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'data_board','売上ボード','profit',1,ARRAY['ops','team']::text[],'{"mult":1.08}'::jsonb,'数字の見える化','common',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'refund_care','丁寧な返品対応','service',1,ARRAY['service','mood']::text[],'{"customers":12,"mult":1.05}'::jsonb,'信頼を守る','common',2
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_cards (id,name,term,cost,tags,effect,text,rarity,unlock_level) values (
  'launch_party','開店記念デー','scarcity',3,ARRAY['promo','scarcity','bundle']::text[],'{"customers":90,"price":40}'::jsonb,'一気に盛り上げる','epic',5
) on conflict (id) do update set
  name=excluded.name, term=excluded.term, cost=excluded.cost, tags=excluded.tags,
  effect=excluded.effect, text=excluded.text, rarity=excluded.rarity, unlock_level=excluded.unlock_level;
insert into public.office_combos (id,name,match,bonus_mult,term_id) values (
  'queue_ops','行列さばき','{"tags":["queue","ops"]}'::jsonb,1.15,'rotation'
) on conflict (id) do update set
  name=excluded.name, match=excluded.match, bonus_mult=excluded.bonus_mult, term_id=excluded.term_id;
insert into public.office_combos (id,name,match,bonus_mult,term_id) values (
  'youth_price','学生ターゲット','{"tags":["youth","price"]}'::jsonb,1.2,'target'
) on conflict (id) do update set
  name=excluded.name, match=excluded.match, bonus_mult=excluded.bonus_mult, term_id=excluded.term_id;
insert into public.office_combos (id,name,match,bonus_mult,term_id) values (
  'bundle_upsell','セット販売コンボ','{"tags":["bundle","upsell"]}'::jsonb,1.15,'set_sales'
) on conflict (id) do update set
  name=excluded.name, match=excluded.match, bonus_mult=excluded.bonus_mult, term_id=excluded.term_id;
insert into public.office_combos (id,name,match,bonus_mult,term_id) values (
  'scarcity_promo','限定感マーケ','{"tags":["scarcity","promo"]}'::jsonb,1.25,'scarcity'
) on conflict (id) do update set
  name=excluded.name, match=excluded.match, bonus_mult=excluded.bonus_mult, term_id=excluded.term_id;
insert into public.office_combos (id,name,match,bonus_mult,term_id) values (
  'sns_buzz','口コミ拡散','{"tags":["sns","promo"]}'::jsonb,1.2,'wom'
) on conflict (id) do update set
  name=excluded.name, match=excluded.match, bonus_mult=excluded.bonus_mult, term_id=excluded.term_id;
insert into public.office_combos (id,name,match,bonus_mult,term_id) values (
  'gold_starter','整理券×学割×セット','{"card_ids":["organize_ticket","student_discount","set_deal"]}'::jsonb,1.1,'unit_price'
) on conflict (id) do update set
  name=excluded.name, match=excluded.match, bonus_mult=excluded.bonus_mult, term_id=excluded.term_id;
insert into public.office_combos (id,name,match,bonus_mult,term_id) values (
  'service_repeat','リピート接客','{"tags":["service","repeat"]}'::jsonb,1.15,'repeat'
) on conflict (id) do update set
  name=excluded.name, match=excluded.match, bonus_mult=excluded.bonus_mult, term_id=excluded.term_id;
insert into public.office_combos (id,name,match,bonus_mult,term_id) values (
  'diff_story','差別化ストーリー','{"tags":["diff","promo"]}'::jsonb,1.18,'diff'
) on conflict (id) do update set
  name=excluded.name, match=excluded.match, bonus_mult=excluded.bonus_mult, term_id=excluded.term_id;
insert into public.office_employees (id,name,role,passive,price) values (
  'emp_cashier','レジ上手の先輩','ops','{"type":"cost_reduce","amount":1}'::jsonb,400
) on conflict (id) do update set
  name=excluded.name, role=excluded.role, passive=excluded.passive, price=excluded.price;
insert into public.office_employees (id,name,role,passive,price) values (
  'emp_sns','SNS好きの後輩','promo','{"type":"tag_boost","tag":"sns","factor":1.2}'::jsonb,500
) on conflict (id) do update set
  name=excluded.name, role=excluded.role, passive=excluded.passive, price=excluded.price;
insert into public.office_employees (id,name,role,passive,price) values (
  'emp_chef','こだわりキッチン','quality','{"type":"tag_boost","tag":"price","factor":1.15}'::jsonb,600
) on conflict (id) do update set
  name=excluded.name, role=excluded.role, passive=excluded.passive, price=excluded.price;
insert into public.office_employees (id,name,role,passive,price) values (
  'emp_greeter','笑顔の受付','service','{"type":"tag_boost","tag":"service","factor":1.2}'::jsonb,450
) on conflict (id) do update set
  name=excluded.name, role=excluded.role, passive=excluded.passive, price=excluded.price;
insert into public.office_employees (id,name,role,passive,price) values (
  'emp_analyst','数字好きの経理','ops','{"type":"mult_bonus","amount":0.05}'::jsonb,550
) on conflict (id) do update set
  name=excluded.name, role=excluded.role, passive=excluded.passive, price=excluded.price;
insert into public.office_employees (id,name,role,passive,price) values (
  'emp_runner','動き回るホール','ops','{"type":"tag_boost","tag":"queue","factor":1.25}'::jsonb,500
) on conflict (id) do update set
  name=excluded.name, role=excluded.role, passive=excluded.passive, price=excluded.price;
insert into public.office_employees (id,name,role,passive,price) values (
  'emp_buyer','仕入れ上手','cost','{"type":"tag_boost","tag":"cost","factor":1.2}'::jsonb,520
) on conflict (id) do update set
  name=excluded.name, role=excluded.role, passive=excluded.passive, price=excluded.price;
insert into public.office_employees (id,name,role,passive,price) values (
  'emp_mc','盛り上げ役','promo','{"type":"tag_boost","tag":"promo","factor":1.15}'::jsonb,480
) on conflict (id) do update set
  name=excluded.name, role=excluded.role, passive=excluded.passive, price=excluded.price;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'customers','客数','何人来てくれたか。売上の左の数字。','売上 = 客数 × 客単価',null
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'unit_price','客単価','一人あたりいくら払ってくれたか。','売上 = 客数 × 客単価','upsell_drink'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'repeat','リピート率','また来てくれる割合。客数を安定させる。',null,'loyalty_stamp'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'rotation','回転率','同じ席・時間で何組回せるか。',null,'organize_ticket'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'cost','原価','仕入れや材料にかかるお金。下げすぎ注意。','利益 ≒ 売上 − 原価','cost_cut_pack'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'profit','利益','売ったあと手元に残る分。','利益 ≒ 売上 − 原価','data_board'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'target','ターゲット','だれに届けるかの仮説。当たると効く。',null,'student_discount'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'diff','差別化','ほかと違う理由。選ばれるフック。',null,'story_sign'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'wom','口コミ','人づてやSNSでの広がり。',null,'word_of_mouth'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'set_sales','セット販売','まとめて売る工夫。単価を上げやすい。',null,'set_deal'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'scarcity','限定感','今だけの空気。来店のきっかけになる。',null,'limited_poster'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'ops','オペレーション','現場の流れ。詰まると客数が落ちる。',null,'staff_brief'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'service','接客品質','気持ちよさ。リピートと口コミに効く。',null,'smile_service'
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'mult','倍率','施策の噛み合いで売上が何倍になるか。','売上 = 客数 × 客単価 × 倍率',null
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'norma','ノルマ','その日クリアしたい売上の目安。','達成率 = 売上 ÷ ノルマ',null
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'hypothesis','仮説','現場データから立てる「なぜ」の予想。',null,null
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'combo','コンボ','カードの組み合わせで倍率が跳ねる。',null,null
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'adlib','アドリブ','場のカードに合わせた一言アイデア。',null,null
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'mood','調子','会社のムード。最近の結果で変わる。',null,null
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_terms (id,name,short_desc,formula,unlock_by) values (
  'revenue_eq','売上方程式','売上は客数×客単価。ゲームの基本ルール。','売上 = 客数 × 客単価 × 倍率',null
) on conflict (id) do update set
  name=excluded.name, short_desc=excluded.short_desc, formula=excluded.formula, unlock_by=excluded.unlock_by;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_lunch_queue',null,'pinch','昼ピークの行列','queue',2,100,500,80000,
  '[{"id":"d1","label":"待ち時間","value":"平均18分"},{"id":"d2","label":"離脱率","value":"列の25%が帰る"},{"id":"d3","label":"学生比率","value":"来客の4割"}]'::jsonb,'[{"id":"h_queue","text":"待ちが長くて客が逃げている","correct":true},{"id":"h_taste","text":"味の評価が急に落ちた","correct":false},{"id":"h_price","text":"値段が高すぎて敬遠されている","correct":false}]'::jsonb,ARRAY['queue','ops','youth']::text[],'[{"actor":"newbie","emotion":"worried","line":"先輩、昼の列がドアの外まで出てます…！","action":"enter"},{"actor":"veteran","emotion":"worried","line":"待ってる途中で帰る人もいる。さばき方を変えよう。"},{"actor":"secretary","emotion":"worried","line":"現場データを見て、原因の仮説を1つ選んでね。"}]'::jsonb,'{"summary":"待ちとターゲットを整えると、客数と単価が同時に伸びるよ。","termIds":["customers","unit_price","rotation","target"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_rainy_day',null,'pinch','雨の日の閑散','rainy',2,60,550,45000,
  '[{"id":"d1","label":"来客","value":"晴れの半分"},{"id":"d2","label":"滞在","value":"いつもより長い"},{"id":"d3","label":"検索","value":"『近く 雨』が増"}]'::jsonb,'[{"id":"h1","text":"雨対策の訴求が弱い","correct":true},{"id":"h2","text":"メニューが古くなった","correct":false},{"id":"h3","text":"店員が足りない","correct":false}]'::jsonb,ARRAY['weather','promo','scarcity']::text[],'[{"actor":"newbie","emotion":"worried","line":"雨だとガラガラです…","action":"enter"},{"actor":"veteran","emotion":"worried","line":"来た人は長くいてくれる。呼び込みが課題だね。"}]'::jsonb,'{"summary":"天候ピンチは『今来る理由』を足すのが効く。","termIds":["customers","scarcity","target"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_sold_out',null,'chance','看板メニュー売り切れ','sold_out',2,90,480,55000,
  '[{"id":"d1","label":"欠品","value":"Aセットが午後に切れる"},{"id":"d2","label":"代替","value":"案内がバラバラ"},{"id":"d3","label":"単価","value":"代替注文は低め"}]'::jsonb,'[{"id":"h1","text":"代替の提案が弱く単価が落ちている","correct":true},{"id":"h2","text":"店の場所が分かりにくい","correct":false},{"id":"h3","text":"ライバルの値段が安い","correct":false}]'::jsonb,ARRAY['upsell','bundle','service']::text[],'[{"actor":"newbie","emotion":"worried","line":"人気のセットがもう無いです！","action":"enter"},{"actor":"veteran","emotion":"worried","line":"代わりをうまく出せば、単価を守れる。"}]'::jsonb,'{"summary":"欠品はピンチだけど、セット提案で単価を守れる。","termIds":["unit_price","set_sales","service"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_sns_fire',null,'people','微妙な口コミ拡散','sns_fire',2,110,520,70000,
  '[{"id":"d1","label":"投稿","value":"待ち時間の不満が増加"},{"id":"d2","label":"いいね","value":"料理写真は好調"},{"id":"d3","label":"再来","value":"初来店のリピート低め"}]'::jsonb,'[{"id":"h1","text":"体験の最初（待ち）が悪印象になっている","correct":true},{"id":"h2","text":"味そのものが悪い","correct":false},{"id":"h3","text":"価格表示が間違っている","correct":false}]'::jsonb,ARRAY['sns','queue','service']::text[],'[{"actor":"newbie","emotion":"worried","line":"SNSで待ちの愚痴が広がってます…","action":"enter"},{"actor":"veteran","emotion":"worried","line":"味は好評。入口の体験を直そう。"}]'::jsonb,'{"summary":"口コミは入口体験から生まれる。待ちと接客が鍵。","termIds":["wom","service","rotation"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_rival_open',null,'rival','向かいにお店オープン','rival',3,80,500,55000,
  '[{"id":"d1","label":"客流","value":"昼の常連が減"},{"id":"d2","label":"比較","value":"向こうはセットが強い"},{"id":"d3","label":"強み","value":"うちは空間の評判○"}]'::jsonb,'[{"id":"h1","text":"差別化が伝わらず流されている","correct":true},{"id":"h2","text":"雨のせいだけ","correct":false},{"id":"h3","text":"レジが壊れている","correct":false}]'::jsonb,ARRAY['diff','bundle','promo']::text[],'[{"actor":"newbie","emotion":"worried","line":"向かいがオープンして、常連が減りました…","action":"enter"},{"actor":"veteran","emotion":"worried","line":"同じ土俵で殴り合わず、違いを出そう。"}]'::jsonb,'{"summary":"ライバル対策は安売りより、選ばれる理由づくり。","termIds":["diff","set_sales","target"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_new_hire',null,'people','新人初日のどたばた','new_hire',1,70,450,40000,
  '[{"id":"d1","label":"ミス","value":"オーダー遅れが増加"},{"id":"d2","label":"雰囲気","value":"新人は元気"},{"id":"d3","label":"ベテラン","value":"フォローで手一杯"}]'::jsonb,'[{"id":"h1","text":"オペが属人的で新人に渡せていない","correct":true},{"id":"h2","text":"メニューが多すぎるだけ","correct":false},{"id":"h3","text":"客が意地悪","correct":false}]'::jsonb,ARRAY['ops','team','service']::text[],'[{"actor":"newbie","emotion":"worried","line":"今日から新人なのに、もう迷子です…","action":"enter"},{"actor":"veteran","emotion":"worried","line":"手順を短く共有すれば回る。"}]'::jsonb,'{"summary":"人が増えても、流れが見えないと客数は落ちる。","termIds":["ops","rotation","service"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_food_lunch','food','chance','学食並みの昼ラッシュ','queue',2,120,480,75000,
  '[{"id":"d1","label":"客層","value":"近隣の学生が多い"},{"id":"d2","label":"回転","value":"席が空かない"},{"id":"d3","label":"追加注文","value":"ドリンク率が低い"}]'::jsonb,'[{"id":"h1","text":"回転と追加提案が弱い","correct":true},{"id":"h2","text":"看板が暗い","correct":false},{"id":"h3","text":"値段が安すぎる","correct":false}]'::jsonb,ARRAY['queue','upsell','youth']::text[],'[{"actor":"newbie","emotion":"worried","line":"飲食の昼、席が埋まりっぱなし！","action":"enter"},{"actor":"veteran","emotion":"worried","line":"回して、ついで買いも取りにいこう。"}]'::jsonb,'{"summary":"飲食は回転×ついで買いが売上の型。","termIds":["rotation","unit_price","customers"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_fashion_display','fashion','chance','ウィンドウの反応が薄い','viral',2,50,2200,130000,
  '[{"id":"d1","label":"通行","value":"前は通るが入り薄い"},{"id":"d2","label":"客単価","value":"入店者は高め"},{"id":"d3","label":"SNS","value":"コーデ投稿が少ない"}]'::jsonb,'[{"id":"h1","text":"入店のきっかけ（世界観）が弱い","correct":true},{"id":"h2","text":"在庫が多すぎる","correct":false},{"id":"h3","text":"店員が多すぎる","correct":false}]'::jsonb,ARRAY['diff','promo','sns']::text[],'[{"actor":"newbie","emotion":"worried","line":"前は通るのに、入ってくれない…","action":"enter"},{"actor":"veteran","emotion":"worried","line":"差別化が見える演出を足そう。"}]'::jsonb,'{"summary":"ファッションは『入る理由』が客数を決める。","termIds":["diff","wom","customers"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_tech_bug','tech','pinch','デモ機がフリーズ','equipment',2,40,3000,140000,
  '[{"id":"d1","label":"体験","value":"デモ失敗で離脱"},{"id":"d2","label":"興味","value":"説明会の予約は残ってる"},{"id":"d3","label":"代替","value":"紙の資料しかない"}]'::jsonb,'[{"id":"h1","text":"体験の代替導線がない","correct":true},{"id":"h2","text":"価格が安すぎる","correct":false},{"id":"h3","text":"ロゴがダサい","correct":false}]'::jsonb,ARRAY['ops','service','tech']::text[],'[{"actor":"newbie","emotion":"worried","line":"デモ機が落ちて、説明が止まりました…","action":"enter"},{"actor":"veteran","emotion":"worried","line":"止まっても売れる流れを用意しよう。"}]'::jsonb,'{"summary":"テックは体験が商品。止まっても案内できる型が要る。","termIds":["ops","service","unit_price"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_event_gate','event','pinch','入場ゲート渋滞','deadline',3,200,800,200000,
  '[{"id":"d1","label":"待ち","value":"ゲート前30分"},{"id":"d2","label":"物販","value":"開場後のピークが短い"},{"id":"d3","label":"クレーム","value":"整理の不満"}]'::jsonb,'[{"id":"h1","text":"入場オペがボトルネック","correct":true},{"id":"h2","text":"演目がつまらない","correct":false},{"id":"h3","text":"チケットが高い","correct":false}]'::jsonb,ARRAY['queue','ops','promo']::text[],'[{"actor":"newbie","emotion":"worried","line":"ゲートが詰まって、中の売上が止まります！","action":"enter"},{"actor":"veteran","emotion":"worried","line":"入口を直すと、会場全体が回る。"}]'::jsonb,'{"summary":"イベントは入口の回転が全体売上を決める。","termIds":["rotation","customers","ops"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_shop_complaint','shop','people','接客クレーム連鎖','complaint',2,75,1200,100000,
  '[{"id":"d1","label":"クレーム","value":"説明不足が共通"},{"id":"d2","label":"リピート","value":"低下中"},{"id":"d3","label":"商品","value":"評価は普通〜良い"}]'::jsonb,'[{"id":"h1","text":"説明とフォローの型がない","correct":true},{"id":"h2","text":"商品が全部不良","correct":false},{"id":"h3","text":"家賃が高い","correct":false}]'::jsonb,ARRAY['service','repeat','mood']::text[],'[{"actor":"newbie","emotion":"worried","line":"同じ系統のクレームが続いてます…","action":"enter"},{"actor":"veteran","emotion":"worried","line":"接客の型を揃えれば守れる。"}]'::jsonb,'{"summary":"お店系は信頼がリピート＝客数の土台。","termIds":["service","repeat","customers"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
insert into public.office_events (id,industry,type,title,scene,size,base_customers,base_price,norma,data_chips,hypotheses,weak_tags,intro_beats,coach) values (
  'evt_media_algo','media','chance','投稿が伸びない週','viral',2,30,4000,140000,
  '[{"id":"d1","label":"再生","value":"先週比 −40%"},{"id":"d2","label":"保存","value":"有益系だけ残る"},{"id":"d3","label":"導線","value":"プロフクリック低い"}]'::jsonb,'[{"id":"h1","text":"話題性と導線の設計が弱い","correct":true},{"id":"h2","text":"機材が古いだけ","correct":false},{"id":"h3","text":"編集者が多すぎる","correct":false}]'::jsonb,ARRAY['sns','promo','scarcity']::text[],'[{"actor":"newbie","emotion":"worried","line":"いつも通り投稿してるのに伸びません…","action":"enter"},{"actor":"veteran","emotion":"worried","line":"限定感と次の行動をセットで出そう。"}]'::jsonb,'{"summary":"発信は『見る理由』と『次の一手』が客数になる。","termIds":["wom","scarcity","customers"]}'::jsonb
) on conflict (id) do update set
  industry=excluded.industry, type=excluded.type, title=excluded.title, scene=excluded.scene, size=excluded.size,
  base_customers=excluded.base_customers, base_price=excluded.base_price, norma=excluded.norma,
  data_chips=excluded.data_chips, hypotheses=excluded.hypotheses, weak_tags=excluded.weak_tags,
  intro_beats=excluded.intro_beats, coach=excluded.coach;
