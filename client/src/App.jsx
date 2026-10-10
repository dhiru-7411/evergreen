import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import PostDetail from './pages/PostDetail';
import CreatePost from './pages/CreatePost';
import EditPost from './pages/EditPost';
import History from './pages/History';
import SuggestFix from './pages/SuggestFix';
import FixReview from './pages/FixReview';
import Inbox from './pages/Inbox';
import NotFound from './pages/NotFound';

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/posts/:id/history" element={<History />} />
          <Route path="/posts/:id/edit" element={protect(<EditPost />)} />
          <Route path="/posts/:id/suggest" element={protect(<SuggestFix />)} />
          <Route path="/fixes/:fixId" element={<FixReview />} />
          <Route path="/inbox" element={protect(<Inbox />)} />
          <Route path="/create" element={protect(<CreatePost />)} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
