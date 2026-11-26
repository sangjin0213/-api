-- 자격증 좋아요/싫어요 테이블 (Supabase 대시보드 → SQL Editor에 붙여 넣고 Run)
-- 한 사람(익명 ID)이 한 자격증에 한 표만: (jm_cd, voter_id)를 기본키로 지정해 DB가 중복을 막음

create table if not exists public.cert_votes (
  jm_cd      text        not null check (jm_cd ~ '^[0-9]{1,6}$'),   -- 종목코드(q-net jmCd)
  voter_id   uuid        not null,                                    -- 브라우저 쿠키로 발급한 익명 ID
  vote       smallint    not null check (vote in (1, -1)),            -- 1 = 좋아요, -1 = 싫어요
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (jm_cd, voter_id)
);

-- 내 투표를 빠르게 찾기 위한 색인
create index if not exists cert_votes_voter_idx on public.cert_votes (voter_id);

-- 자격증별 좋아요·싫어요 개수 집계 뷰
create or replace view public.cert_vote_counts
with (security_invoker = true) as
select
  jm_cd,
  count(*) filter (where vote = 1)::int  as likes,
  count(*) filter (where vote = -1)::int as dislikes
from public.cert_votes
group by jm_cd;

-- 브라우저(anon 키)로는 직접 읽고 쓰지 못하게 막기 → 오직 서버(api/vote.js, secret 키)만 접근
alter table public.cert_votes enable row level security;
revoke all on public.cert_votes       from anon, authenticated;
revoke all on public.cert_vote_counts from anon, authenticated;
