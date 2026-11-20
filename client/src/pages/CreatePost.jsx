import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import PostForm from '../components/PostForm';
import { postPath } from '../utils/format';

const CreatePost = () => {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    setError('');
    try {
      const response = await api.post('/posts', values);
      navigate(postPath(response.data));
    } catch (err) {
      setError(errorMessage(err, 'Failed to create post'));
    }
  };

  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Write a post</h1>
      <p className="muted">
        Add the packages your post depends on, for example <code className="mono">react 19</code>, and readers will
        know when it needs updating.
      </p>
      <PostForm submitLabel="Publish" onSubmit={handleSubmit} error={error} />
    </div>
  );
};

export default CreatePost;
