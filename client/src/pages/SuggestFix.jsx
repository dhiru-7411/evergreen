import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import PostForm from '../components/PostForm';
import { FreshnessReport } from '../components/Freshness';
import { Loading, ErrorBox } from '../components/Status';

const SuggestFix = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: post, loading, error } = useFetch(`/posts/${id}`);
  const [submitError, setSubmitError] = useState('');

  if (loading && !post) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!post) return null;
  if (post.author?._id === user.id) return <Navigate to={`/posts/${id}/edit`} replace />;

  const handleSubmit = async (values) => {
    setSubmitError('');
    try {
      const res = await api.post(`/posts/${id}/fixes`, { ...values, baseRevision: post.revision });
      navigate(`/fixes/${res.data._id}`);
    } catch (err) {
      setSubmitError(errorMessage(err, 'Failed to submit fix'));
    }
  };

  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <p className="faint">
        <Link to={`/posts/${id}`}>← Back to post</Link>
      </p>
      <h1>Suggest a fix</h1>
      <p className="muted">
        Edit the post the way you think it should read. @{post.author?.username} will review your changes as a diff, and
        if they merge it you'll be credited as a contributor.
      </p>
      <div style={{ margin: '20px 0' }}>
        <FreshnessReport freshness={post.freshness} />
      </div>
      <PostForm
        initial={post}
        submitLabel="Submit fix for review"
        noteLabel="Why is this change needed?"
        notePlaceholder="e.g. Express 5 handles async errors natively, so the wrapper is unnecessary"
        onSubmit={handleSubmit}
        error={submitError}
      />
    </div>
  );
};

export default SuggestFix;
