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
const Topics = lazy(() => import('./pages/Topics'));
const TopicDetail = lazy(() => import('./pages/TopicDetail'));
const NewTopic = lazy(() => import('./pages/NewTopic'));
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'));
const TopicRequests = lazy(() => import('./pages/TopicRequests'));
const VerifyEmail = lazy(() => import('./pages/AccountPages').then((m) => ({ default: m.VerifyEmail })));
const ForgotPassword = lazy(() => import('./pages/AccountPages').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/AccountPages').then((m) => ({ default: m.ResetPassword })));
const Account = lazy(() => import('./pages/AccountPages').then((m) => ({ default: m.Account })));
const VerifyBanner = lazy(() => import('./pages/AccountPages').then((m) => ({ default: m.VerifyBanner })));

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navbar />
      <Suspense fallback={null}>
        <VerifyBanner />
      </Suspense>
      <main className="container" id="main" tabIndex={-1}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/account" element={protect(<Account />)} />
            <Route path="/posts/:id" element={<PostDetail />} />
            <Route path="/posts/:id/history" element={<History />} />
            <Route path="/posts/:id/edit" element={protect(<EditPost />)} />
            <Route path="/posts/:id/suggest" element={protect(<SuggestFix />)} />
            <Route path="/fixes/:fixId" element={<FixReview />} />
            <Route path="/u/:username" element={<Profile />} />
            <Route path="/learn" element={<Topics />} />
            <Route path="/learn/new" element={protect(<NewTopic />)} />
            <Route path="/learn/review" element={protect(<ReviewQueue />)} />
            <Route path="/learn/requests" element={<TopicRequests />} />
            <Route path="/learn/:slug" element={<TopicDetail />} />
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
