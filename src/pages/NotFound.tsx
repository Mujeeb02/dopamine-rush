import { Link } from 'react-router-dom';import { ArrowRight } from 'lucide-react';
export default function NotFound(){return <div className="page not-found"><span className="eyebrow">OFF THE PLAYING FIELD</span><strong className="error-number">404</strong><h1>This path doesn't lead to a game.</h1><p className="muted">Let's get you back to something worth playing.</p><Link to="/game" className="button">Explore the games<ArrowRight size={18}/></Link></div>;}

