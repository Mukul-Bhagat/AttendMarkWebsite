import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  useEffect(() => {
    // IntersectionObserver for scroll reveals
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, observerOptions);

    // Observe all fade-up elements
    const fadeUpElements = document.querySelectorAll('.fade-up');
    fadeUpElements.forEach(el => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="bg-[#050505] font-sans text-neutral-400 antialiased min-h-screen">
      <style>{`
        html {
          scroll-behavior: smooth;
        }

        body {
          background-color: #050505;
        }

        /* Red Gradient Utility */
        .bg-red-gradient {
          background: linear-gradient(135deg, #D61C22 0%, #A61217 100%);
        }

        /* Button Glow Effect */
        .btn-glow {
          transition: all 0.3s ease;
        }

        .btn-glow:hover {
          box-shadow: 0 0 20px rgba(214, 28, 34, 0.5);
          border-color: rgba(214, 28, 34, 0.5);
        }

        /* Moving Glowing Orbs Background */
        .background-orbs {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          z-index: -10;
          pointer-events: none;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
        }

        .orb-1 {
          width: 500px;
          height: 500px;
          background: white;
          opacity: 0.1;
          top: -100px;
          left: -100px;
          animation: animate-blob 20s ease-in-out infinite;
        }

        .orb-2 {
          width: 600px;
          height: 600px;
          background: #D61C22;
          opacity: 0.2;
          bottom: -150px;
          right: -150px;
          animation: animate-blob 25s ease-in-out infinite reverse;
        }

        @keyframes animate-blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(100px, -100px) scale(1.1);
          }
          50% {
            transform: translate(-80px, 80px) scale(0.9);
          }
          75% {
            transform: translate(120px, 100px) scale(1.05);
          }
        }

        /* Background Grid Pattern */
        .bg-grid {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background-image: radial-gradient(#333 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
          z-index: -9;
          pointer-events: none;
          opacity: 0.3;
        }

        /* Glassmorphism Cards */
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.05);
        }

        /* Scroll Reveal Animations */
        .fade-up {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }

        .fade-up.revealed {
          opacity: 1;
          transform: translateY(0);
        }

        .fade-up-delay-1 {
          transition-delay: 0.1s;
        }

        .fade-up-delay-2 {
          transition-delay: 0.2s;
        }

        .fade-up-delay-3 {
          transition-delay: 0.3s;
        }

        .fade-up-delay-4 {
          transition-delay: 0.4s;
        }
      `}</style>

      {/* Moving Glowing Orbs Background */}
      <div className="background-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>
      
      {/* Background Grid Pattern */}
      <div className="bg-grid"></div>

      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-[#050505]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
              <img src="/assets/atendmarkwhitelogo.png" alt="AttendMark Logo" className="h-16 w-auto object-contain"/>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a className="text-sm font-medium text-neutral-400 hover:text-white transition-colors" href="#features">Features</a>
              <a className="text-sm font-medium text-neutral-400 hover:text-white transition-colors" href="#roles">Roles</a>
              <a className="text-sm font-medium text-neutral-400 hover:text-white transition-colors" href="#how-it-works">How It Works</a>
              <a className="text-sm font-medium text-neutral-400 hover:text-white transition-colors" href="#pricing">Pricing</a>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <Link className="text-sm font-medium text-neutral-400 hover:text-white" to="/login">Log in</Link>
              <Link 
                className="inline-flex items-center justify-center px-5 py-2.5 border border-[#D61C22]/30 text-sm font-medium rounded-full shadow-lg shadow-red-500/20 text-white bg-red-gradient hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D61C22] transition-all transform hover:scale-105 btn-glow" 
                to="/register"
              >
                Get Started
              </Link>
            </div>
            <div className="md:hidden flex items-center">
              <button className="text-neutral-400 hover:text-white p-2" type="button">
                <span className="material-symbols-outlined">menu</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="text-center max-w-4xl mx-auto fade-up">
            <div className="inline-flex items-center px-4 py-2 rounded-full border border-white/10 glass-card mb-8 shadow-sm hover:border-white/20 transition-colors cursor-default">
              <span className="flex h-2 w-2 rounded-full bg-[#D61C22] mr-3 animate-pulse"></span>
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">New: Enhanced Geofencing Accuracy</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-tight">
              Smart Attendance Management for <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">Modern Organizations</span>.
            </h1>
            <p className="mt-6 text-xl md:text-2xl text-neutral-400 max-w-2xl mx-auto font-light leading-relaxed">
              Streamline tracking with QR codes, geolocation, and real-time insights. The all-in-one solution for schools and businesses.
            </p>
            <div className="mt-12 flex justify-center">
              <Link 
                className="inline-flex items-center justify-center px-8 py-4 text-base font-bold rounded-full text-white bg-red-gradient border border-[#D61C22]/30 hover:opacity-90 shadow-lg shadow-red-500/25 transition-all hover:scale-105 btn-glow" 
                to="/register"
              >
                Get Started
                <span className="material-symbols-outlined ml-2 text-[20px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[#050505] relative" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20 fade-up">
            <h2 className="text-base text-[#D61C22] font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-white sm:text-4xl">
              Why Choose AttendMark?
            </p>
            <p className="mt-4 max-w-2xl text-xl text-neutral-400 mx-auto">
              Everything you need to manage attendance efficiently, securely, and intelligently.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-2xl transition-all duration-300 group fade-up fade-up-delay-1">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 mb-6 group-hover:scale-110 transition-transform duration-300 border border-red-500/20">
                <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Smart Tracking</h3>
              <p className="text-neutral-400 leading-relaxed">
                Automated attendance marking via dynamic QR codes and facial recognition, eliminating proxy attendance completely.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl transition-all duration-300 group fade-up fade-up-delay-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform duration-300 border border-emerald-500/20">
                <span className="material-symbols-outlined text-3xl">dashboard</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Real-Time Dashboard</h3>
              <p className="text-neutral-400 leading-relaxed">
                Live updates on who is in, who is late, and who is absent. Visualize attendance trends with intuitive charts.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl transition-all duration-300 group fade-up fade-up-delay-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform duration-300 border border-purple-500/20">
                <span className="material-symbols-outlined text-3xl">domain</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Multi-Organization Support</h3>
              <p className="text-neutral-400 leading-relaxed">
                Manage multiple branches, departments, or entire subsidiary companies from a single super-admin account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-24 bg-[#050505] border-y border-white/10" id="roles">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Designed for Every Role</h2>
            <p className="mt-4 text-lg text-neutral-400">Tailored experiences for every level of your organization.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card rounded-xl p-6 transition-all duration-300 fade-up fade-up-delay-1">
              <div className="flex items-center space-x-3 mb-4">
                <span className="material-symbols-outlined text-rose-400 text-3xl">admin_panel_settings</span>
                <h3 className="text-lg font-bold text-white">Super Admin</h3>
              </div>
              <p className="text-sm text-neutral-400">Full system control. Manage subscriptions, global settings, and oversee all organizations.</p>
            </div>
            <div className="glass-card rounded-xl p-6 transition-all duration-300 fade-up fade-up-delay-2">
              <div className="flex items-center space-x-3 mb-4">
                <span className="material-symbols-outlined text-orange-400 text-3xl">manage_accounts</span>
                <h3 className="text-lg font-bold text-white">Company Administrator</h3>
              </div>
              <p className="text-sm text-neutral-400">Manage departments, set schedules, configure geofences, and generate organization reports.</p>
            </div>
            <div className="glass-card rounded-xl p-6 transition-all duration-300 fade-up fade-up-delay-3">
              <div className="flex items-center space-x-3 mb-4">
                <span className="material-symbols-outlined text-cyan-400 text-3xl">supervisor_account</span>
                <h3 className="text-lg font-bold text-white">Manager/Session Admin</h3>
              </div>
              <p className="text-sm text-neutral-400">Monitor team attendance, approve leave requests, and track daily team performance.</p>
            </div>
            <div className="glass-card rounded-xl p-6 transition-all duration-300 fade-up fade-up-delay-4">
              <div className="flex items-center space-x-3 mb-4">
                <span className="material-symbols-outlined text-emerald-400 text-3xl">person</span>
                <h3 className="text-lg font-bold text-white">Employee/User</h3>
              </div>
              <p className="text-sm text-neutral-400">Easy check-in/out, view personal history, apply for leaves, and see upcoming schedules.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-[#050505]" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">How It Works</h2>
            <p className="mt-4 text-lg text-neutral-400">Simple setup, powerful results.</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 z-0"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
              <div className="text-center fade-up fade-up-delay-1">
                <div className="w-20 h-20 mx-auto glass-card rounded-full border-4 border-[#050505] flex items-center justify-center mb-6 shadow-xl shadow-black/50">
                  <span className="text-2xl font-bold text-red-400">01</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Register & Setup</h3>
                <p className="text-neutral-400 px-4">Create your organization account, add employees, and define your locations and shifts.</p>
              </div>
              <div className="text-center fade-up fade-up-delay-2">
                <div className="w-20 h-20 mx-auto glass-card rounded-full border-4 border-[#050505] flex items-center justify-center mb-6 shadow-xl shadow-black/50">
                  <span className="text-2xl font-bold text-red-400">02</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Mark Attendance</h3>
                <p className="text-neutral-400 px-4">Employees check in using the mobile app via QR scan or geolocation verification.</p>
              </div>
              <div className="text-center fade-up fade-up-delay-3">
                <div className="w-20 h-20 mx-auto glass-card rounded-full border-4 border-[#050505] flex items-center justify-center mb-6 shadow-xl shadow-black/50">
                  <span className="text-2xl font-bold text-red-400">03</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Analyze Data</h3>
                <p className="text-neutral-400 px-4">Access detailed reports, export payroll data, and gain insights into workforce patterns.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-[#050505] border-t border-white/10" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Simple Pricing</h2>
            <p className="mt-4 text-lg text-neutral-400">Choose the plan that fits your organization size.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="glass-card rounded-2xl p-8 flex flex-col fade-up fade-up-delay-1">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white">Free / Basic</h3>
                <p className="text-neutral-400 mt-2">For small teams and startups.</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">$0</span>
                <span className="text-neutral-400">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center text-neutral-300">
                  <span className="material-symbols-outlined text-emerald-400 mr-3 text-sm">check</span>
                  Up to 10 Users
                </li>
                <li className="flex items-center text-neutral-300">
                  <span className="material-symbols-outlined text-emerald-400 mr-3 text-sm">check</span>
                  Basic Reporting
                </li>
                <li className="flex items-center text-neutral-300">
                  <span className="material-symbols-outlined text-emerald-400 mr-3 text-sm">check</span>
                  QR Code Check-in
                </li>
              </ul>
              <a className="w-full block text-center py-3 px-4 glass-card hover:border-white/20 rounded-lg text-white font-medium transition-all" href="#">
                Start for Free
              </a>
            </div>
            <div className="glass-card rounded-2xl p-8 relative flex flex-col shadow-2xl shadow-red-500/10 fade-up fade-up-delay-2">
              <div className="absolute top-0 right-0 -mt-3 -mr-3 bg-red-gradient text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-sm">
                Most Popular
              </div>
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white">Premium</h3>
                <p className="text-neutral-400 mt-2">For growing businesses.</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">$29</span>
                <span className="text-neutral-400">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center text-neutral-300">
                  <span className="material-symbols-outlined text-emerald-400 mr-3 text-sm">check</span>
                  Unlimited Users
                </li>
                <li className="flex items-center text-neutral-300">
                  <span className="material-symbols-outlined text-emerald-400 mr-3 text-sm">check</span>
                  Advanced Analytics & Export
                </li>
                <li className="flex items-center text-neutral-300">
                  <span className="material-symbols-outlined text-emerald-400 mr-3 text-sm">check</span>
                  Geofencing & Facial Recog.
                </li>
                <li className="flex items-center text-neutral-300">
                  <span className="material-symbols-outlined text-emerald-400 mr-3 text-sm">check</span>
                  Priority Support
                </li>
              </ul>
              <a className="w-full block text-center py-3 px-4 bg-red-gradient border border-[#D61C22]/30 hover:opacity-90 rounded-lg text-white font-medium transition-colors shadow-lg shadow-red-500/20 btn-glow" href="#">
                Upgrade to Pro
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050505] border-t border-white/10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="mb-6">
                <img src="/assets/atendmarkwhitelogo.png" alt="AttendMark White Logo" className="h-16 w-auto object-contain"/>
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Modernizing attendance for the future of work. Simple, secure, and smart.
              </p>
            </div>
            <div className="col-span-1 md:col-span-2"></div>
            <div className="col-span-1 md:col-span-1">
              <h4 className="text-white font-bold mb-4 uppercase text-sm tracking-wider">Contact Us</h4>
              <ul className="space-y-3">
                <li className="flex items-start text-neutral-400 text-sm">
                  <span className="material-symbols-outlined mr-2 text-base mt-0.5">email</span>
                  taskmateai.app@gmail.com
                </li>
                <li className="flex items-start text-neutral-400 text-sm">
                  <span className="material-symbols-outlined mr-2 text-base mt-0.5">location_on</span>
                  Nashik, Maharashtra, India
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-neutral-500">© 2024 AttendMark. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a className="text-sm text-neutral-500 hover:text-white transition-colors" href="#">Privacy Policy</a>
              <a className="text-sm text-neutral-500 hover:text-white transition-colors" href="#">Terms of Service</a>
            </div>
          </div>
          <div className="flex flex-row items-center justify-center gap-3 mt-12 pt-8 border-t border-white/10">
            <span className="text-slate-500 text-xs uppercase tracking-widest">Powered by</span>
            <img src="/assets/aiallywhite.png" alt="AI Ally" className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

