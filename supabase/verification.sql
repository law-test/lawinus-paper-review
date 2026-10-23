-- Optional transaction-only integration verification AFTER 001_paper_review.sql.
-- Execute as the SQL Editor project owner on an isolated project/staging DB.
-- Uses temporary test Auth identities, rolls everything back, touches no real notes.
begin;
insert into auth.users (id, aud, role, email, is_anonymous)
values ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','paper-review-test-a@example.invalid',true),
       ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','paper-review-test-b@example.invalid',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare a jsonb; b jsonb; nid uuid; result jsonb;
begin
  a := public.paper_review_create_note('human-1021-1559','{"text":"private verification","anchorType":"footnote","page":183,"noteId":"fn-192"}');
  if a->'note'->>'visibility' <> 'private' then raise exception 'private default failed'; end if;
  if a->'note' ? 'owner_id' or a->'note' ? 'userId' then raise exception 'owner id leak'; end if;
  nid := (a->'note'->>'id')::uuid;
  b := public.paper_review_create_note('human-1021-1559','{"text":"shared verification","visibility":"shared"}');
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  result := public.paper_review_list_notes('human-1021-1559',null,false);
  if exists(select 1 from jsonb_array_elements(result->'notes') n where n->>'id' = nid::text) then raise exception 'private note leaked to B'; end if;
  if not exists(select 1 from jsonb_array_elements(result->'notes') n where n->>'id' = b->'note'->>'id' and n->>'editable'='false') then raise exception 'shared note read failed'; end if;
  begin
    perform public.paper_review_update_note('human-1021-1559',nid,'{"revision":1,"text":"attack"}');
    raise exception 'B updated A note';
  exception when sqlstate 'PT404' then null;
  end;
  begin
    perform public.paper_review_delete_note('human-1021-1559',nid,'{"revision":1}');
    raise exception 'B deleted A note';
  exception when sqlstate 'PT404' then null;
  end;
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  a := public.paper_review_update_note('human-1021-1559',nid,'{"revision":1,"text":"updated"}');
  if a->'note'->>'revision' <> '2' then raise exception 'revision update failed'; end if;
  begin
    perform public.paper_review_update_note('human-1021-1559',nid,'{"revision":1,"text":"stale"}');
    raise exception 'stale revision accepted';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform public.paper_review_create_note('human-1021-1559','{"text":"bad footnote","noteId":"fn-247"}');
    raise exception 'out-of-baseline footnote accepted';
  exception when sqlstate 'PT400' then null;
  end;
  begin
    perform public.paper_review_create_note('human-1021-1559','{"text":"bad coordinate","x":1.1,"y":0.1}');
    raise exception 'bad coordinate accepted';
  exception when sqlstate 'PT400' then null;
  end;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  result := public.paper_review_list_notes('human-1021-1559',null,false);
  if exists(select 1 from jsonb_array_elements(result->'notes') n where n->>'visibility' = 'private') then raise exception 'anon saw private note'; end if;
  begin
    perform public.paper_review_create_note('human-1021-1559','{"text":"anonymous attack"}');
    raise exception 'unauthenticated mutation succeeded';
  exception when sqlstate 'PT401' then null;
  end;
  if has_table_privilege('anon','public.paper_review_notes','SELECT') or has_table_privilege('authenticated','public.paper_review_notes','SELECT') then raise exception 'direct table privilege leak'; end if;
  if has_function_privilege('anon','public.paper_review_create_note(text,jsonb)','EXECUTE') then raise exception 'anon has mutation grant'; end if;
  raise notice 'paper-review verification passed (transaction will roll back)';
end $$;
rollback;
