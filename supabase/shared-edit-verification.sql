-- Hosted PostgreSQL checks use an independent temporary dataset; all data rollback.
begin;
create temporary table shared_verification_baseline as select count(*) n from public.paper_review_notes;
create function pg_temp.verify(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'verification failed: %',label;end if;end;$$;
insert into public.paper_review_datasets(id,title,thesis_sha256,source_hwp_sha256,page_count,footnote_count)
values('shared-verification-rollback','Temporary verification',repeat('0',64),repeat('1',64),2,2);
select pg_temp.verify(paper_review_private.seed_shared_catalog('shared-verification-rollback',
 '[{"kind":"paragraph","targetId":"P0001","originalText":"Original body","page":1},{"kind":"footnote","targetId":"fn-001","originalText":"Original footnote","page":1}]')=2,'catalog seed');
set local role anon;
select pg_temp.verify((public.paper_review_shared_catalog('shared-verification-rollback')->>'totalCount')::integer=2,'public catalog');
do $$begin
 begin perform * from paper_review_private.edit_catalog;raise exception 'raw table exposed';exception when insufficient_privilege then null;end;
 begin perform public.paper_review_shared_save('shared-verification-rollback','paragraph','P0001',0,'attack');raise exception 'anonymous write exposed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select pg_temp.verify((public.paper_review_shared_save('shared-verification-rollback','paragraph','P0001',0,'First edit','A edit')->'edit'->>'revision')::integer=1,'first edit');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);
set local role authenticated;
select pg_temp.verify((public.paper_review_shared_save('shared-verification-rollback','paragraph','P0001',1,'Second edit','B edit')->'edit'->>'revision')::integer=2,'other visitor edits common content');
do $$begin
 begin perform public.paper_review_shared_save('shared-verification-rollback','paragraph','P0001',1,'stale');raise exception 'stale overwrite allowed';exception when sqlstate 'PT409' then null;end;
 begin perform public.paper_review_shared_save('shared-verification-rollback','paragraph','P9999',0,'unknown');raise exception 'uncatalogued target allowed';exception when sqlstate 'PT404' then null;end;
 begin perform public.paper_review_shared_save('shared-verification-rollback','paragraph','P0001',2,repeat('x',100001));raise exception 'oversize allowed';exception when sqlstate 'PT400' then null;end;
end;$$;
select pg_temp.verify(public.paper_review_shared_save('shared-verification-rollback','paragraph','P0001',2,null,'Restore original',0)->'edit'->>'text'='Original body','restoration');
select pg_temp.verify((public.paper_review_shared_save('shared-verification-rollback','paragraph','P0001',3,null,'Restore first edit',1)->'edit'->>'revision')::integer=4,'restoration new revision');
reset role;
set local role anon;
select pg_temp.verify(public.paper_review_shared_history('shared-verification-rollback','paragraph','P0001')->'original'->>'text'='Original body','original preserved');
select pg_temp.verify(jsonb_array_length(public.paper_review_shared_history('shared-verification-rollback','paragraph','P0001')->'revisions')=4,'all history preserved');
select pg_temp.verify((public.paper_review_shared_export('shared-verification-rollback',0,null,2)->>'totalCount')::integer=4,'export total');
select pg_temp.verify((public.paper_review_shared_export('shared-verification-rollback',0,null,2)->>'hasMore')::boolean,'export pagination');
select pg_temp.verify(position('10000000-0000-4000-8000-' in public.paper_review_shared_export('shared-verification-rollback')::text)=0,'actor UUID omitted');
reset role;
do $$begin
 begin update paper_review_private.edit_catalog set original_text='tamper' where dataset_id='shared-verification-rollback';raise exception 'original mutable';exception when sqlstate 'PT403' then null;end;
 begin delete from paper_review_private.edit_revisions where dataset_id='shared-verification-rollback';raise exception 'history deletable';exception when sqlstate 'PT403' then null;end;
end;$$;
select pg_temp.verify((select count(*) from public.paper_review_notes)=(select n from shared_verification_baseline),'existing notes unchanged');
select 'PASS' status,'Public read; authenticated shared edits; conflict; immutable original/history; restoration; export; notes preserved; rollback all test rows' verified;
rollback;
