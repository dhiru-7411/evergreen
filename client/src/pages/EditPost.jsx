import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import PostForm from '../components/PostForm';
import { FreshnessReport } from '../components/Freshness';
import { Loading, ErrorBox } from '../components/Status';

const EditPost = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: post, loading, error } = useFetch(`/posts/${id}`);
  const [submitError, setSubmitError] = useState('');

  if (loading && !post) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!post) return null;
  if (post.author?._id !== user.id) return <Navigate to={`/posts/${id}`} replace />;

  const handleSubmit = async (values) => {
    setSubmitError('');
    try {
      await api.patch(`/posts/${id}`, { ...values, baseRevision: post.revision });
      navigate(`/posts/${id}`);
    } catch (err) {
      setSubmitError(
        err.response?.status === 409
          ? `${errorMessage(err)} Your changes weren't saved; copy them, then reload this page.`
          : errorMessage(err, 'Failed to save')
      );
    }
  };

  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <p className="faint">
        <Link to={`/posts/${id}`}>← Back to post</Link>
      </p>
      <h1>Edit post</h1>
      <p className="muted">Saving creates revision {post.revision + 1}. The change note shows up in the post's history.</p>
      <div style={{ margin: '20px 0' }}>
        <FreshnessReport freshness={post.freshness} />
      </div>
      <PostForm
        initial={post}
        submitLabel={`Save revision ${post.revision + 1}`}
        noteLabel="What changed?"
        notePlaceholder="e.g. Updated examples for React 19"
        onSubmit={handleSubmit}
        error={submitError}
      />
    </div>
  );
};

export default EditPost;
