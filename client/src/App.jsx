import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { Loading } from './components/Status';
import Home from './pages/Home';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const EditPost = lazy(() => import('./pages/EditPost'));
const History = lazy(() => import('./pages/History'));
const SuggestFix = lazy(() => import('./pages/SuggestFix'));
const FixReview = lazy(() => import('./pages/FixReview'));
const Inbox = lazy(() => import('./pages/Inbox'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Profile = lazy(() => import('./pages/Profile'));

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/posts/:id" element={<PostDetail />} />
            <Route path="/posts/:id/history" element={<History />} />
            <Route path="/posts/:id/edit" element={protect(<EditPost />)} />
            <Route path="/posts/:id/suggest" element={protect(<SuggestFix />)} />
            <Route path="/fixes/:fixId" element={<FixReview />} />
            <Route path="/u/:username" element={<Profile />} />
            <Route path="/inbox" element={protect(<Inbox />)} />
            <Route path="/create" element={protect(<CreatePost />)} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}

export default App;
