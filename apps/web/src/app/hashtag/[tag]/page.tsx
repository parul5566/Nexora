import Link from 'next/link';
import { PostCard, type PostView } from '../../../components/posts';
import { AppShell } from '../../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default async function HashtagPage({ params }: { params: { tag: string } }) {
  let posts: PostView[] = [];
  let error: string | null = null;
  try {
    const res = await fetch(`${API}/api/v1/hashtags/${encodeURIComponent(params.tag)}/posts`, { cache: 'no-store' });
    if (res.ok) posts = (await res.json()).items;
  } catch {
    error = 'Could not load posts for this hashtag.';
  }

  return (
    <AppShell active="home">
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <nav style={{ marginBottom: 12 }}><Link href="/home" style={{ color: 'var(--fb-text-secondary)' }}>← Home</Link></nav>
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24, color: 'var(--fb-blue)' }}>#{params.tag}</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>{posts.length} public {posts.length === 1 ? 'post' : 'posts'}</p>
        </div>
        {error && <p className="error-text">{error}</p>}
        {posts.length === 0 && !error && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p className="muted">No public posts with this hashtag yet.</p>
          </div>
        )}
        {posts.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </AppShell>
  );
}
