"use strict";
(() => {
  // Suppress known harmless warnings from extensions and PDF.js
  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    const message = args.join(' ');
    // Filter out known harmless warnings
    if (message.includes('InstallTrigger is deprecated') ||
        message.includes('onmozfullscreenchange is deprecated') ||
        message.includes('onmozfullscreenerror is deprecated') ||
        message.includes('cross-origin object as property')) {
      return; // Suppress these warnings
    }
    originalConsoleWarn.apply(console, args);
  };
  const yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // Handle home link clicks to reset personalization
  const setupHomeNavigation = () => {
      const logoLink = document.querySelector('.logo');
      const homeLinks = document.querySelectorAll('a[href="#"], a[href="#top"]');
      
      const handleHomeClick = (e) => {
          // Only handle if we're on a personalized URL
          const path = window.location.pathname;
          // Check for both patterns: /firstname_companyname and /_companyname
          if (path && path !== '/' && (path.match(/^\/([^_\/]+)_([^_\/]+)\/?$/) || path.match(/^\/_([^\/]+)\/?$/))) {
              e.preventDefault();
              // Reset to root and reload to show default greeting
              window.history.pushState({}, '', '/');
              window.location.reload();
          }
      };
      
      if (logoLink) {
          logoLink.addEventListener('click', handleHomeClick);
      }
      
      homeLinks.forEach(link => {
          link.addEventListener('click', handleHomeClick);
      });
  };
  
  // Handle browser back/forward navigation
  window.addEventListener('popstate', () => {
      // Reload page to reflect new URL state
      window.location.reload();
  });
  
  // GitHub Pages SPA redirect handling
  // Check if we were redirected from 404.html
  (function() {
      const redirect = sessionStorage.redirect;
      delete sessionStorage.redirect;
      if (redirect && redirect !== location.pathname) {
          // Restore the original URL
          history.replaceState(null, null, redirect);
      }
  })();
  
  // Setup navigation handlers
  setupHomeNavigation();

  // ========================================
  // ANALYTICS SETUP
  // Track personalized visits with rich context
  // ========================================
  
  // Parse URL for personalization early
  const parsePersonalizationForAnalytics = () => {
    const path = window.location.pathname;
    const hashPath = window.location.hash.substring(1);
    const currentPath = path || hashPath;
    
    // Match pattern like /firstname_companyname
    const matchWithName = currentPath.match(/^\/([^_\/]+)_([^_\/]+)\/?$/);
    if (matchWithName) {
      const firstname = matchWithName[1].replace(/-/g, ' ');
      const companyname = matchWithName[2].replace(/-/g, ' ');
      return { 
        firstname, 
        companyname, 
        type: 'with-name',
        urlPattern: `${firstname}_${companyname}`,
        isPersonalized: true
      };
    }
    
    // Match pattern like /_companyname
    const matchCompanyOnly = currentPath.match(/^\/_([^\/]+)\/?$/);
    if (matchCompanyOnly) {
      const companyname = matchCompanyOnly[1].replace(/-/g, ' ');
      return { 
        companyname, 
        type: 'company-only',
        urlPattern: `_${companyname}`,
        isPersonalized: true
      };
    }
    
    return { type: 'default', isPersonalized: false };
  };
  
  const personalizationData = parsePersonalizationForAnalytics();
  
  // Initialize analytics with custom dimensions via GTM dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // Send initial page view with personalization data
  window.dataLayer.push({
    'event': 'page_view',
    'page_title': document.title,
    'page_location': window.location.href,
    'page_path': window.location.pathname,
    'is_personalized': personalizationData.isPersonalized,
    'visitor_firstname': personalizationData.firstname || 'none',
    'visitor_company': personalizationData.companyname || 'none',
    'url_pattern_type': personalizationData.type,
    'url_pattern': personalizationData.urlPattern || 'default',
    'visitor_type': personalizationData.isPersonalized ? 'personalized' : 'organic'
  });
  
  console.log('✓ Google Tag Manager initialized with personalization:', personalizationData);
  
  // Initialize Microsoft Clarity with custom tags
  if (typeof clarity !== 'undefined') {
    // Tag this session with personalization info
    if (personalizationData.isPersonalized) {
      clarity('set', 'visitor_type', 'personalized');
      clarity('set', 'url_pattern', personalizationData.urlPattern);
      
      if (personalizationData.firstname) {
        clarity('set', 'firstname', personalizationData.firstname);
      }
      if (personalizationData.companyname) {
        clarity('set', 'company', personalizationData.companyname);
      }
      
      // Identify user for easier filtering in Clarity dashboard
      const userId = personalizationData.urlPattern || 'anonymous';
      clarity('identify', userId, {
        type: personalizationData.type,
        company: personalizationData.companyname || 'none'
      });
    } else {
      clarity('set', 'visitor_type', 'organic');
    }
    
    console.log('✓ Microsoft Clarity initialized with personalization:', personalizationData);
  }
  
  // Initialize PostHog with personalization context
  if (typeof posthog !== 'undefined') {
    // Set user properties for session tracking
    const posthogProps = {
      visitor_type: personalizationData.isPersonalized ? 'personalized' : 'organic',
      url_pattern_type: personalizationData.type,
      is_personalized: personalizationData.isPersonalized
    };
    
    if (personalizationData.firstname) {
      posthogProps.firstname = personalizationData.firstname;
    }
    if (personalizationData.companyname) {
      posthogProps.company = personalizationData.companyname;
    }
    if (personalizationData.urlPattern) {
      posthogProps.url_pattern = personalizationData.urlPattern;
    }
    
    // Identify user for session replay filtering
    if (personalizationData.urlPattern) {
      posthog.identify(personalizationData.urlPattern, posthogProps);
    } else {
      posthog.register(posthogProps);
    }
    
    // Capture initial page view with context
    posthog.capture('page_view', {
      ...posthogProps,
      page_title: document.title,
      page_path: window.location.pathname
    });
    
    console.log('✓ PostHog initialized with personalization:', personalizationData);
  }
  
  // Track section visibility and time spent
  const sectionTimeTracking = new Map();
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const sectionId = entry.target.id;
      if (!sectionId) return;
      
      if (entry.isIntersecting) {
        // Section became visible
        sectionTimeTracking.set(sectionId, Date.now());
        
        // Track section view via GTM
        window.dataLayer.push({
          'event': 'section_view',
          'section_name': sectionId,
          'is_personalized': personalizationData.isPersonalized,
          'visitor_company': personalizationData.companyname || 'none'
        });
        
        if (typeof clarity !== 'undefined') {
          clarity('event', 'section_view', { section: sectionId });
        }
        
        if (typeof posthog !== 'undefined') {
          posthog.capture('section_view', { section: sectionId });
        }
        
      } else {
        // Section left viewport - calculate time spent
        const startTime = sectionTimeTracking.get(sectionId);
        if (startTime) {
          const timeSpent = Math.round((Date.now() - startTime) / 1000); // seconds
          
          // Track time spent via GTM
          window.dataLayer.push({
            'event': 'section_time_spent',
            'section_name': sectionId,
            'time_seconds': timeSpent,
            'is_personalized': personalizationData.isPersonalized,
            'visitor_company': personalizationData.companyname || 'none'
          });
          
          if (typeof clarity !== 'undefined') {
            clarity('event', 'section_exit', { 
              section: sectionId, 
              time_seconds: timeSpent 
            });
          }
          
          if (typeof posthog !== 'undefined') {
            posthog.capture('section_exit', { 
              section: sectionId, 
              time_seconds: timeSpent 
            });
          }
          
          sectionTimeTracking.delete(sectionId);
        }
      }
    });
  }, { threshold: 0.5 }); // 50% visible
  
  // Observe all sections
  document.querySelectorAll('section[id]').forEach(section => {
    sectionObserver.observe(section);
  });
  
  // Track scroll depth
  let maxScrollDepth = 0;
  const scrollDepthThresholds = [25, 50, 75, 90, 100];
  const reachedThresholds = new Set();
  
  window.addEventListener('scroll', () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPosition = window.scrollY;
    const scrollPercent = Math.round((scrollPosition / scrollHeight) * 100);
    
    // Track maximum scroll depth
    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = scrollPercent;
    }
    
    // Track milestone thresholds
    scrollDepthThresholds.forEach(threshold => {
      if (scrollPercent >= threshold && !reachedThresholds.has(threshold)) {
        reachedThresholds.add(threshold);
        
        // Track scroll depth via GTM
        window.dataLayer.push({
          'event': 'scroll_depth',
          'scroll_percent': threshold,
          'is_personalized': personalizationData.isPersonalized,
          'visitor_company': personalizationData.companyname || 'none'
        });
        
        if (typeof clarity !== 'undefined') {
          clarity('event', 'scroll_milestone', { percent: threshold });
        }
        
        if (typeof posthog !== 'undefined') {
          posthog.capture('scroll_depth', { percent: threshold });
        }
      }
    });
  }, { passive: true });
  
  // Track video interactions - Optimized for performance
  const trackVideoEvent = (video, eventName, additionalData = {}) => {
    // Cache DOM queries to avoid repeated lookups
    const videoIndex = video.getAttribute('data-video-index');
    const videoContainer = video.closest('.project-card');
    const projectTitle = videoContainer?.querySelector('h3')?.textContent || 'Unknown';
    
    // Prepare common data once
    const commonData = {
      video_index: videoIndex,
      project_title: projectTitle,
      is_personalized: personalizationData.isPersonalized,
      visitor_company: personalizationData.companyname || 'none',
      ...additionalData
    };
    
    // Use requestIdleCallback for non-critical tracking to avoid blocking video
    const trackAnalytics = () => {
      // Track via GTM
      window.dataLayer.push({
        'event': eventName,
        ...commonData
      });
      
      // Track via Clarity (if available)
      if (typeof clarity !== 'undefined') {
        clarity('event', eventName, { 
          video: videoIndex, 
          project: projectTitle,
          ...additionalData
        });
      }
      
      // Track via PostHog (if available)
      if (typeof posthog !== 'undefined') {
        posthog.capture(eventName, commonData);
      }
    };
    
    // Use requestIdleCallback for better performance, fallback to setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(trackAnalytics, { timeout: 100 });
    } else {
      setTimeout(trackAnalytics, 0);
    }
  };
  
  // Track outbound link clicks
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Track external links
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
      const linkText = link.textContent.trim() || link.getAttribute('aria-label') || 'Unknown';
      
      // Track via GTM
      window.dataLayer.push({
        'event': 'outbound_click',
        'link_url': href,
        'link_text': linkText,
        'is_personalized': personalizationData.isPersonalized,
        'visitor_company': personalizationData.companyname || 'none'
      });
      
      if (typeof clarity !== 'undefined') {
        clarity('event', 'outbound_click', { 
          url: href, 
          text: linkText 
        });
      }
      
      if (typeof posthog !== 'undefined') {
        posthog.capture('outbound_click', { 
          url: href, 
          text: linkText 
        });
      }
    }
    
    // Track internal navigation
    if (href.startsWith('#')) {
      const sectionId = href.substring(1);
      
      // Track via GTM
      window.dataLayer.push({
        'event': 'internal_navigation',
        'section_id': sectionId,
        'is_personalized': personalizationData.isPersonalized,
        'visitor_company': personalizationData.companyname || 'none'
      });
      
      if (typeof clarity !== 'undefined') {
        clarity('event', 'internal_nav', { section: sectionId });
      }
      
      if (typeof posthog !== 'undefined') {
        posthog.capture('internal_navigation', { section: sectionId });
      }
    }
  });
  
  // Track resume modal interactions
  const trackResumeEvent = (action) => {
    // Track via GTM
    window.dataLayer.push({
      'event': 'resume_interaction',
      'action': action,
      'is_personalized': personalizationData.isPersonalized,
      'visitor_company': personalizationData.companyname || 'none'
    });
    
    if (typeof clarity !== 'undefined') {
      clarity('event', 'resume', { action: action });
    }
    
    if (typeof posthog !== 'undefined') {
      posthog.capture('resume_interaction', { action: action });
    }
  };
  
  // Track session end and send final metrics
  const trackSessionEnd = () => {
    const sessionDuration = Math.round((Date.now() - performance.timing.navigationStart) / 1000);
    
    // Track via GTM
    window.dataLayer.push({
      'event': 'session_end',
      'max_scroll_depth': maxScrollDepth,
      'is_personalized': personalizationData.isPersonalized,
      'visitor_company': personalizationData.companyname || 'none',
      'session_duration': sessionDuration
    });
    
    if (typeof posthog !== 'undefined') {
      posthog.capture('session_end', {
        max_scroll_depth: maxScrollDepth,
        session_duration: sessionDuration
      });
    }
  };
  
  // Track when user leaves
  window.addEventListener('beforeunload', trackSessionEnd);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      trackSessionEnd();
    }
  });
  
  // Make tracking functions globally available
  window.trackVideoEvent = trackVideoEvent;
  window.trackResumeEvent = trackResumeEvent;

  const commandEl = document.getElementById('terminal-command');
  const commandCursor = document.getElementById('command-cursor');
  const outputEl = document.getElementById('terminal-output');
  const finalCursorLine = document.getElementById('final-cursor-line');
  
  // Get all paragraph elements for the output
  const outputParas = Array.from({length: 20}, (_, i) => document.getElementById(`output-p${i + 1}`));

  if (commandEl && outputEl && outputParas.every(p => p)) {
      const commandToType = "./introduce.sh";
      const terminalBody = document.querySelector('.terminal-body');
      
      // Detect mobile device
      const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Capitalize first letter of each word, but preserve ALL CAPS
      const capitalizeWords = (str) => {
          return str.split(' ').map(word => {
              // If word is all caps, keep it as is
              if (word === word.toUpperCase() && word.length > 1) {
                  return word;
              }
              // Otherwise capitalize normally
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }).join(' ');
      };
      
      // Parse URL path for personalization
      const parsePersonalization = () => {
          const path = window.location.pathname;
          
          // Safari compatibility: Also check for URL hash as fallback
          const hashPath = window.location.hash.substring(1);
          const currentPath = path || hashPath;
          
          // Match pattern like /firstname_companyname
          const matchWithName = currentPath.match(/^\/([^_\/]+)_([^_\/]+)\/?$/);
          if (matchWithName) {
              const firstname = capitalizeWords(matchWithName[1].replace(/-/g, ' '));
              const companyname = capitalizeWords(matchWithName[2].replace(/-/g, ' '));
              return { firstname, companyname, type: 'with-name' };
          }
          
          // Match pattern like /_companyname (no firstname)
          const matchCompanyOnly = currentPath.match(/^\/_([^\/]+)\/?$/);
          if (matchCompanyOnly) {
              const companyname = capitalizeWords(matchCompanyOnly[1].replace(/-/g, ' '));
              return { companyname, type: 'company-only' };
          }
          
          return null;
      };
      
      // Get personalization data
      const personalization = parsePersonalization();
      
      // Create personalized greeting
      const getGreeting = () => {
          if (personalization) {
              if (personalization.type === 'with-name') {
                  return {
                      text: `Hey ${personalization.firstname},`,
                      html: `Hey <span class="personalized-name">${personalization.firstname}</span>,`
                  };
              } else if (personalization.type === 'company-only') {
                  return {
                      text: `Hi Brilliant Minds at ${personalization.companyname},`,
                      html: `Hi <span class="personalized-name">Brilliant Minds</span> at <span class="personalized-name">${personalization.companyname}</span>,`
                  };
              }
          }
          return { text: "Hey, I'm Arjun.", html: "Hey, I'm Arjun." };
      };
      
      // Create company line for with-name type
      const getCompanyLine = () => {
          if (personalization && personalization.type === 'with-name') {
              return {
                  text: `Ready for enterprise scale at ${personalization.companyname}.`,
                  html: `Ready for enterprise scale at <span class="personalized-name">${personalization.companyname}</span>.`
              };
          }
          return null;
      };
      
      // Mobile version - more concise
      const mobileTexts = [
          getGreeting(),
          personalization ? "I am Arjun." : "I build revenue-generating AI products, solo and end-to-end.",
          "",
          "// Live Portfolio:",
          "• 10+ Production iOS Apps",
          "• 4 with Agentic Backends (RAG & Multi-Step Reasoning)",
          "",
          "// Core Experience:",
          "• 1.5+ years building products from scratch solo.",
          "• 3.5+ years as a Data Scientist at a Startup.",
          "",
          personalization && personalization.type === 'with-name' ? getCompanyLine() : "Proven in startup & solo. Ready for enterprise scale.",
          "",
          "↓ Scroll to see the apps in action ↓"
      ].filter(item => item !== null); // Remove null items
      
      // Desktop version - detailed
      const desktopTexts = [
          getGreeting(),
          personalization ? "I am Arjun." : "",
          "",
          "I build AI products that generate revenue. Solo. End-to-end.",
          "",
          "Live Now:",
          "10 iOS apps. 4 with production agentic backends—LLM orchestration, RAG pipelines, and multi-step reasoning in real user workflows.",
          "",
          "Background:",
          "4+ years in Data Science → 1.5 years building products from scratch. Design, development, marketing, deployment, optimization, support. Everything.",
          "",
          "What that means:",
          "• I've debugged hallucinations at 2am.",
          "• Optimized RAG for actual user queries.",
          "• I've built and shipped AI systems that people pay for.",
          "",
          personalization && personalization.type === 'with-name' ? getCompanyLine() : "I've proven the model solo. Now, I want to tackle challenges at a scale that's impossible alone.",
          "↓ Scroll to see the apps in action ↓"
      ].filter(item => item !== null); // Remove null items
      
      // Choose the appropriate text array based on device
      const texts = isMobile ? mobileTexts : desktopTexts;

      // Pre-calculate height and width by rendering all text invisibly
      const preCalculateHeight = () => {
          const terminalWindow = document.querySelector('.terminal-window');
          
          // Temporarily show and populate all paragraphs invisibly
          outputEl.style.opacity = '0';
          outputEl.style.visibility = 'visible';
          finalCursorLine.style.display = 'flex';
          
          texts.forEach((content, index) => {
              // Handle both string and object (with text/html properties)
              const text = typeof content === 'string' ? content : content.text;
              const html = typeof content === 'string' ? content : content.html;
              
              // Use HTML version for calculation if available
              if (html !== text) {
                  outputParas[index].innerHTML = html;
              } else {
                  outputParas[index].textContent = text;
              }
              
              // Apply section-header class for proper styling calculation
              if (text === "Live Now:" || text === "Background:" || text === "What that means:" || 
                  text === "// Live Portfolio:" || text === "// Core Experience:" || 
                  text === "↓ Scroll to see the apps in action ↓") {
                  outputParas[index].classList.add('section-header');
              }
          });
          
          // Measure the height and width
          const calculatedHeight = terminalBody.offsetHeight;
          const calculatedWidth = terminalWindow.offsetWidth;
          
          // Set fixed dimensions
          terminalBody.style.height = `${calculatedHeight}px`;
          terminalWindow.style.width = `${calculatedWidth}px`;
          
          // Clear all text and restore visibility for typewriter effect
          outputParas.forEach(p => {
              p.textContent = '';
              p.innerHTML = '';
          });
          outputEl.style.opacity = '1';
          outputEl.style.visibility = 'hidden';
          finalCursorLine.style.display = 'none';
      };

      const typewriter = (element, content, onComplete, speed = 10) => {
          // Handle both string and object (with text/html properties)
          const text = typeof content === 'string' ? content : content.text;
          const html = typeof content === 'string' ? content : content.html;
          const hasHTML = html !== text;
          
          let i = 0;
          element.textContent = '';
          const interval = setInterval(() => {
              if (i < text.length) {
                  element.textContent += text.charAt(i);
                  i++;
              } else {
                  clearInterval(interval);
                  
                  // Replace with HTML version if available
                  if (hasHTML) {
                      element.innerHTML = html;
                  }
                  
                  // Add section-header class to specific headers
                  if (text === "Live Now:" || text === "Background:" || text === "What that means:" || 
                      text === "// Live Portfolio:" || text === "// Core Experience:" || 
                      text === "↓ Scroll to see the apps in action ↓") {
                      element.classList.add('section-header');
                  }
                  if (onComplete) setTimeout(onComplete, 50); // Faster delay between lines
              }
          }, speed);
      };

      const typeLinesSequentially = (index = 0) => {
          if (index < texts.length) {
              typewriter(outputParas[index], texts[index], () => typeLinesSequentially(index + 1));
          } else {
              // All lines typed, show final cursor
              finalCursorLine.style.display = 'flex';
          }
      };

      // Pre-calculate the terminal height before animation starts
      preCalculateHeight();

      setTimeout(() => {
          typewriter(commandEl, commandToType, () => {
              commandCursor.style.display = 'none';
              outputEl.style.visibility = 'visible';
              typeLinesSequentially(); // Start typing the output lines
          }, 30);
      }, 500);
  }

  const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
          if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
          }
      });
  }, { threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));
  
  // Active nav link
  const navLinks = Array.from(document.querySelectorAll(".nav-links a"));
  const sections = document.querySelectorAll("section[id]");
  const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
          if (entry.isIntersecting) {
              const id = entry.target.getAttribute('id');
              navLinks.forEach(link => {
                  link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
              });
          }
      });
  }, { rootMargin: "-30% 0px -40% 0px", threshold: 0.2 });
  sections.forEach(section => navObserver.observe(section));

  // Interactive card spotlight
  const cards = document.querySelectorAll('.card');
  window.addEventListener('mousemove', (e) => {
      cards.forEach(card => {
          const rect = card.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          card.style.setProperty('--x', `${(mouseX / rect.width) * 100}%`);
          card.style.setProperty('--y', `${(mouseY / rect.height) * 100}%`);
      });
  });
  
  const hamburgerBtn = document.querySelector('.hamburger-btn');
  const mobileNav = document.querySelector('.mobile-nav');
  const mobileNavLinks = mobileNav.querySelectorAll('a');
  const mobileNavClose = document.querySelector('.mobile-nav-close');
  const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
  
  const toggleMobileNav = () => {
      const isOpen = document.body.classList.toggle('mobile-nav-open');
      hamburgerBtn.setAttribute('aria-expanded', isOpen);
  };
  
  const closeMobileNav = () => {
      document.body.classList.remove('mobile-nav-open');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
  };

  if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', toggleMobileNav);
      mobileNavLinks.forEach(link => {
          link.addEventListener('click', () => {
              if (document.body.classList.contains('mobile-nav-open')) {
                  closeMobileNav();
              }
          });
      });
  }
  
  // Close button in mobile nav
  if (mobileNavClose) {
      mobileNavClose.addEventListener('click', closeMobileNav);
  }
  
  // Close when clicking overlay
  if (mobileNavOverlay) {
      mobileNavOverlay.addEventListener('click', closeMobileNav);
  }

  // ========================================
  // ENHANCED VIDEO MANAGEMENT SYSTEM
  // Optimized for buttery-smooth mobile playback
  // ========================================
  
  const projectVideos = document.querySelectorAll('[data-project-video]');
  
  // Comprehensive video state management
  const videoStates = new Map();
  
  // Track user interaction - PERSISTENT across page lifecycle
  let userHasInteracted = false;
  let interactionTimestamp = 0;
  
  // Video state machine
  const VIDEO_STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    PLAYING: 'playing',
    BUFFERING: 'buffering',
    PAUSED: 'paused',
    ERROR: 'error'
  };
  
  // Initialize state for each video
  projectVideos.forEach(video => {
    const index = parseInt(video.getAttribute('data-video-index'));
    videoStates.set(video, {
      state: VIDEO_STATES.IDLE,
      index: index,
      playAttempts: 0,
      lastPlayAttempt: 0,
      isPreloaded: false,
      hasEnoughData: false,
      isInViewport: false,
      retryTimeout: null
    });
  });
  
  // Enable autoplay after user interaction - MORE ROBUST
  const enableAutoplayOnInteraction = () => {
      userHasInteracted = true;
      interactionTimestamp = Date.now();
      console.log('✓ User interaction detected - autoplay enabled globally');
      
      // Try to play any visible videos that are ready
      projectVideos.forEach(video => {
          const state = videoStates.get(video);
          if (state.isInViewport && video.paused && state.hasEnoughData) {
              console.log(`▶ Attempting autoplay for video ${state.index} after interaction`);
              attemptPlay(video);
          }
      });
  };
  
  // Add interaction listeners - PERSISTENT, not once
  ['touchstart', 'touchend', 'click', 'scroll'].forEach(eventType => {
      document.addEventListener(eventType, () => {
          if (!userHasInteracted) {
              enableAutoplayOnInteraction();
          }
      }, { passive: true });
  });
  
  // Handle page visibility changes - IMPROVED
  document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
          console.log('📱 Page became visible - resuming videos');
          setTimeout(() => {
              projectVideos.forEach(video => {
                  const state = videoStates.get(video);
                  if (state.isInViewport && video.paused && state.hasEnoughData) {
                      console.log(`▶ Resuming video ${state.index} after visibility change`);
                      attemptPlay(video);
                  }
              });
          }, 300); // Longer delay for mobile to settle
      } else {
          console.log('📱 Page hidden - pausing all videos');
          projectVideos.forEach(video => {
              if (!video.paused) {
                  video.pause();
                  const state = videoStates.get(video);
                  state.state = VIDEO_STATES.PAUSED;
              }
          });
      }
  });
  
  // ========================================
  // SIMPLIFIED EVENT LISTENERS
  // Single responsibility, no race conditions
  // ========================================
  
  projectVideos.forEach(video => {
      const container = video.closest('.project-video-container');
      const loadingOverlay = container.querySelector('.video-loading-overlay');
      const state = videoStates.get(video);
      
      // Update loading overlay based on video state
      const updateLoadingOverlay = () => {
          if (!loadingOverlay) return;
          
          const shouldShowLoading = 
              state.state === VIDEO_STATES.LOADING || 
              state.state === VIDEO_STATES.BUFFERING;
              
          if (shouldShowLoading) {
              loadingOverlay.classList.add('visible');
          } else {
              loadingOverlay.classList.remove('visible');
          }
      };
      
      // LOADSTART: Video begins loading
      video.addEventListener('loadstart', () => {
          console.log(`📥 Video ${state.index} - loadstart`);
          state.state = VIDEO_STATES.LOADING;
          state.hasEnoughData = false;
          updateLoadingOverlay();
      });
      
      // LOADEDDATA: First frame loaded
      video.addEventListener('loadeddata', () => {
          console.log(`✓ Video ${state.index} - first frame loaded (readyState: ${video.readyState})`);
      });
      
      // CANPLAY: Some data available (readyState >= 2)
      video.addEventListener('canplay', () => {
          console.log(`✓ Video ${state.index} - can play (readyState: ${video.readyState})`);
          // Don't mark as ready yet - wait for more data on mobile
      });
      
      // CANPLAYTHROUGH: Enough data to play through (readyState >= 3)
      video.addEventListener('canplaythrough', () => {
          console.log(`✓✓ Video ${state.index} - can play through (readyState: ${video.readyState})`);
          state.hasEnoughData = true;
          state.state = VIDEO_STATES.READY;
          updateLoadingOverlay();
          
          // Auto-play if in viewport and user has interacted
          if (state.isInViewport && userHasInteracted && video.paused) {
              setTimeout(() => attemptPlay(video), 100);
          }
      });
      
      // WAITING: Buffering/stalled
      video.addEventListener('waiting', () => {
          console.log(`⏸ Video ${state.index} - buffering`);
          state.state = VIDEO_STATES.BUFFERING;
          updateLoadingOverlay();
          
          // Pause background loading to prioritize this video
          pauseBackgroundLoading(video);
      });
      
      // PLAYING: Successfully playing
      video.addEventListener('playing', () => {
          console.log(`▶ Video ${state.index} - playing`);
          state.state = VIDEO_STATES.PLAYING;
          state.playAttempts = 0; // Reset attempts
          updateLoadingOverlay();
          
          // Track video play event - Make it non-blocking
          if (typeof window.trackVideoEvent === 'function') {
              // Use setTimeout to make tracking asynchronous and non-blocking
              setTimeout(() => {
                  window.trackVideoEvent(video, 'video_play', {
                      video_state: 'playing'
                  });
              }, 0);
          }
          
          // Resume background loading after video is stable
          setTimeout(() => {
              if (!video.paused) {
                  resumeBackgroundLoading();
              }
          }, 3000);
      });
      
      // PAUSE: Video paused
      video.addEventListener('pause', () => {
          if (state.state !== VIDEO_STATES.BUFFERING) {
              console.log(`⏸ Video ${state.index} - paused`);
              state.state = VIDEO_STATES.PAUSED;
              updateLoadingOverlay();
          }
      });
      
      // ERROR: Loading error
      video.addEventListener('error', (e) => {
          console.error(`❌ Video ${state.index} - error:`, e);
          state.state = VIDEO_STATES.ERROR;
          updateLoadingOverlay();
      });
      
      // PROGRESS: Download progress (for monitoring)
      video.addEventListener('progress', () => {
          if (video.buffered.length > 0) {
              const bufferedEnd = video.buffered.end(video.buffered.length - 1);
              const duration = video.duration;
              if (duration > 0) {
                  const percentBuffered = (bufferedEnd / duration) * 100;
                  console.log(`📊 Video ${state.index} - ${percentBuffered.toFixed(0)}% buffered`);
              }
          }
      });
  });
  
  // ========================================
  // IMPROVED VIDEO PLAY FUNCTION
  // Robust retry logic for mobile
  // ========================================
  
  const attemptPlay = async (video) => {
      const state = videoStates.get(video);
      const now = Date.now();
      
      // Prevent rapid retry attempts
      if (now - state.lastPlayAttempt < 1000) {
          console.log(`⏭ Video ${state.index} - throttling play attempts`);
          return;
      }
      
      state.lastPlayAttempt = now;
      state.playAttempts++;
      
      console.log(`▶ Video ${state.index} - play attempt #${state.playAttempts} (readyState: ${video.readyState})`);
      
      // Check if video has enough data
      // CRITICAL: On mobile, we need readyState >= 3 (HAVE_FUTURE_DATA)
      if (video.readyState < 3) {
          console.log(`⏳ Video ${state.index} - waiting for more data (current: ${video.readyState}, need: 3)`);
          
          // Wait for canplaythrough event with timeout
          return new Promise((resolve) => {
              const timeout = setTimeout(() => {
                  video.removeEventListener('canplaythrough', onReady);
                  console.log(`⏱ Video ${state.index} - timeout waiting for data`);
                  
                  // Try anyway if we have some data and haven't retried too much
                  if (video.readyState >= 2 && state.playAttempts < 5) {
                      setTimeout(() => attemptPlay(video), 2000);
                  }
                  resolve();
              }, 5000);
              
              const onReady = () => {
                  clearTimeout(timeout);
                  console.log(`✓ Video ${state.index} - ready, attempting play`);
                  setTimeout(() => attemptPlay(video), 100);
                  resolve();
              };
              
              video.addEventListener('canplaythrough', onReady, { once: true });
          });
      }
      
      // Pause other videos first
      pauseOtherVideos(video);
      
      // Attempt to play
      try {
          await video.play();
          console.log(`✓✓ Video ${state.index} - playing successfully`);
          state.state = VIDEO_STATES.PLAYING;
          
      } catch (error) {
          console.log(`❌ Video ${state.index} - play failed:`, error.name);
          
          // Handle different error types
          if (error.name === 'NotAllowedError') {
              // Mobile autoplay blocked - wait for user interaction
              if (!userHasInteracted) {
                  console.log(`🔒 Video ${state.index} - waiting for user interaction`);
                  return;
              }
              
              // User has interacted but still blocked - retry with exponential backoff
              if (state.playAttempts < 8) {
                  const delay = Math.min(1000 * Math.pow(1.5, state.playAttempts - 1), 5000);
                  console.log(`🔄 Video ${state.index} - retrying in ${delay}ms`);
                  
                  state.retryTimeout = setTimeout(() => {
                      attemptPlay(video);
                  }, delay);
              }
              
          } else if (error.name === 'AbortError') {
              // Play was interrupted - retry once
              if (state.playAttempts < 3) {
                  console.log(`🔄 Video ${state.index} - play interrupted, retrying`);
                  setTimeout(() => attemptPlay(video), 1000);
              }
              
          } else {
              console.error(`❌ Video ${state.index} - unexpected error:`, error);
          }
      }
  };
  
  // ========================================
  // SIMPLIFIED BACKGROUND LOADING
  // ========================================
  
  let currentlyPlayingVideo = null;
  let isBackgroundLoadingPaused = false;
  
  const pauseBackgroundLoading = (priorityVideo) => {
      if (!isBackgroundLoadingPaused) {
          isBackgroundLoadingPaused = true;
          currentlyPlayingVideo = priorityVideo;
          console.log(`⏸ Background loading paused for video ${videoStates.get(priorityVideo).index}`);
      }
  };
  
  const resumeBackgroundLoading = () => {
      if (isBackgroundLoadingPaused) {
          isBackgroundLoadingPaused = false;
          console.log('▶ Background loading resumed');
      }
  };
  
  // ========================================
  // OPTIMIZED PRELOADING SYSTEM
  // Load FIRST video immediately, then rest in background after page load completes
  // ========================================
  
  const preloadFirstVideoThenRest = () => {
      const sortedVideos = Array.from(projectVideos).sort((a, b) => {
          const stateA = videoStates.get(a);
          const stateB = videoStates.get(b);
          return (stateA?.index || 0) - (stateB?.index || 0);
      });
      
      if (sortedVideos.length === 0) return;
      
      const firstVideo = sortedVideos[0];
      const firstState = videoStates.get(firstVideo);
      const restVideos = sortedVideos.slice(1);
      
      console.log(`🚀 Loading first video (index ${firstState.index}) to complete page load...`);
      
      // Load the first video immediately
      firstState.isPreloaded = true;
      firstVideo.preload = 'auto';
      firstVideo.load();
      
      // Once first video has enough data (canplay = ~10 seconds buffered), page load is complete
      const onFirstVideoReady = () => {
          console.log(`✓✓ First video ready - page load complete! Loading remaining videos in background...`);
          
          // Now start loading the rest of the videos sequentially in the background
          let currentIndex = 0;
          
          const loadNextBackgroundVideo = () => {
              // Pause if active video is buffering
              if (isBackgroundLoadingPaused) {
                  console.log('⏸ Background loading paused - waiting for active video');
                  setTimeout(loadNextBackgroundVideo, 2000);
                  return;
              }
              
              if (currentIndex >= restVideos.length) {
                  console.log('✓✓ All background videos loaded');
                  return;
              }
              
              const video = restVideos[currentIndex];
              const state = videoStates.get(video);
              
              if (!state.isPreloaded) {
                  // Priority loading: First 2-3 videos get full preload, rest get lighter
                  const isPriority = currentIndex < 2;
                  const loadLevel = isPriority ? 'full (canplaythrough)' : 'light (canplay)';
                  
                  console.log(`📥 Loading video ${state.index} - ${loadLevel}`);
                  
                  state.isPreloaded = true;
                  video.preload = 'auto';
                  video.load();
                  
                  // CRITICAL: Wait for actual playable data, not just metadata
                  const eventToWait = isPriority ? 'canplaythrough' : 'canplay';
                  const timeoutDuration = isPriority ? 12000 : 8000; // More time for full load
                  
                  const timeout = setTimeout(() => {
                      console.log(`⏱ Video ${state.index} - timeout waiting for ${eventToWait}, moving to next`);
                      currentIndex++;
                      loadNextBackgroundVideo();
                  }, timeoutDuration);
                  
                  const onReady = () => {
                      clearTimeout(timeout);
                      state.hasEnoughData = true;
                      console.log(`✓✓ Video ${state.index} - ${eventToWait} fired, READY TO PLAY`);
                      currentIndex++;
                      // Very short delay for sequential loading
                      setTimeout(loadNextBackgroundVideo, 300);
                  };
                  
                  video.addEventListener(eventToWait, onReady, { once: true });
                  video.addEventListener('error', () => {
                      clearTimeout(timeout);
                      console.log(`❌ Video ${state.index} - error, moving to next`);
                      currentIndex++;
                      loadNextBackgroundVideo();
                  }, { once: true });
              } else {
                  currentIndex++;
                  loadNextBackgroundVideo();
              }
          };
          
          // Start background loading after a delay
          setTimeout(loadNextBackgroundVideo, 1500);
      };
      
      // Wait for first video to have enough data to play
      // Reduced timeout to complete page load faster
      const timeout = setTimeout(() => {
          console.log(`⏱ First video timeout (5s) - proceeding anyway`);
          onFirstVideoReady();
      }, 5000); // Reduced from 8s to 5s for faster page completion
      
      // Use loadeddata (first frame) as minimum, then upgrade
      const minDataLoaded = () => {
          clearTimeout(timeout);
          console.log(`✓ First video has data (readyState: ${firstVideo.readyState})`);
          onFirstVideoReady();
      };
      
      // Try canplay first (preferred), fallback to loadeddata
      if (firstVideo.readyState >= 2) {
          // Already has some data
          minDataLoaded();
      } else {
          firstVideo.addEventListener('loadeddata', minDataLoaded, { once: true });
          firstVideo.addEventListener('error', () => {
              clearTimeout(timeout);
              console.log(`❌ First video error - loading rest anyway`);
              onFirstVideoReady();
          }, { once: true });
      }
  };
  
  // Pause all videos except the one passed as parameter
  const pauseOtherVideos = (currentVideo) => {
      projectVideos.forEach(video => {
          if (video !== currentVideo && !video.paused) {
              video.pause();
              const state = videoStates.get(video);
              state.state = VIDEO_STATES.PAUSED;
          }
      });
  };

  // Add play event listeners to pause other videos
  projectVideos.forEach(video => {
      video.addEventListener('play', () => {
          pauseOtherVideos(video);
      });
  });

  // ========================================
  // IMPROVED INTERSECTION OBSERVER
  // Mobile-optimized viewport detection
  // ========================================
  
  const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
          const video = entry.target;
          const card = video.closest('.card');
          const state = videoStates.get(video);
          
          // Mobile-friendly visibility threshold
          const isMobile = window.innerWidth <= 768;
          const minVisibility = isMobile ? 0.4 : 0.5;
          const isVisible = entry.isIntersecting && entry.intersectionRatio >= minVisibility;
          
          console.log(`👁 Video ${state.index} - visibility: ${(entry.intersectionRatio * 100).toFixed(0)}%, visible: ${isVisible}`);
          
          state.isInViewport = isVisible;
          
          if (isVisible) {
              // Highlight the active card
              if (card) {
                  card.classList.add('in-focus');
              }
              
              // Ensure video is loading
              if (!state.isPreloaded) {
                  console.log(`📥 Video ${state.index} - starting load (in viewport)`);
                  state.isPreloaded = true;
                  video.preload = 'auto';
                  video.load();
              }
              
              // Clear any pending retry timeouts
              if (state.retryTimeout) {
                  clearTimeout(state.retryTimeout);
                  state.retryTimeout = null;
              }
              
              // Attempt to play if ready
              if (state.hasEnoughData) {
                  console.log(`▶ Video ${state.index} - has enough data, attempting play`);
                  setTimeout(() => attemptPlay(video), 200);
              } else {
                  console.log(`⏳ Video ${state.index} - waiting for data before play`);
              }
              
          } else {
              // Video out of viewport
              if (card) {
                  card.classList.remove('in-focus');
              }
              
              // Pause video and clear retry attempts
              if (!video.paused) {
                  video.pause();
                  console.log(`⏸ Video ${state.index} - paused (out of viewport)`);
              }
              
              if (state.retryTimeout) {
                  clearTimeout(state.retryTimeout);
                  state.retryTimeout = null;
              }
              
              state.playAttempts = 0;
          }
      });
  }, { 
      threshold: [0.0, 0.3, 0.4, 0.5, 0.7, 1.0], // More granular thresholds
      rootMargin: '0px' // No margin - precise detection
  });

  // Observe all project videos
  projectVideos.forEach(video => {
      videoObserver.observe(video);
  });
  
  // ========================================
  // PROXIMITY OBSERVER (Aggressive Preloading)
  // Starts loading videos 2 screens away for smooth scrolling
  // ========================================
  
  const proximityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
          const video = entry.target;
          const state = videoStates.get(video);
          
          // When video is approaching viewport (2 screens away), ensure it's loading
          if (entry.isIntersecting && !state.isPreloaded) {
              console.log(`📥 Video ${state.index} - proximity preload (2 screens away)`);
              state.isPreloaded = true;
              video.preload = 'auto';
              video.load();
              
              // Immediately wait for it to be playable
              const onProximityReady = () => {
                  state.hasEnoughData = true;
                  console.log(`✓ Video ${state.index} - proximity preload complete`);
              };
              
              // Use canplay for proximity loads (faster than canplaythrough)
              video.addEventListener('canplay', onProximityReady, { once: true });
          }
      });
  }, { 
      threshold: 0,
      rootMargin: '200% 0px 200% 0px' // Increased to 2 screens (200%) for earlier loading
  });
  
  // Observe all project videos for proximity loading
  projectVideos.forEach(video => {
      proximityObserver.observe(video);
  });
  
  // CRITICAL FIX: Start video loading AFTER the window.onload event
  // This ensures the browser's loading bar completes before we initiate heavy downloads.
  window.onload = () => {
    // Start loading first video immediately, then rest in background
    // Use requestIdleCallback for better performance, fallback to immediate
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            console.log('🚀 Starting first video load (idle callback)');
            preloadFirstVideoThenRest();
        }, { timeout: 100 });
    } else {
        setTimeout(() => {
            console.log('🚀 Starting first video load (immediate)');
            preloadFirstVideoThenRest();
        }, 100); // Reduced to 100ms for faster start
    }
  };

  // Experience card expand/collapse functionality
  const experienceCards = document.querySelectorAll('[data-experience-card]');
  
  experienceCards.forEach(card => {
      const expandBtn = card.querySelector('[data-expand-btn]');
      const expandText = expandBtn.querySelector('.expand-text');
      
      expandBtn.addEventListener('click', () => {
          const isExpanded = card.classList.toggle('is-expanded');
          expandText.textContent = isExpanded ? 'Show less' : 'Show details';
      });
  });

  // Resume modal functionality with PDF.js
  const resumeModal = document.getElementById('resume-modal');
  const viewResumeBtn = document.getElementById('view-resume-btn');
  const viewResumeMobileBtn = document.getElementById('view-resume-mobile-btn');
  const resumeModalClose = document.querySelector('.resume-modal-close');
  const resumeModalOverlay = document.querySelector('.resume-modal-overlay');
  const resumeLoader = document.getElementById('resume-loader');
  const canvas = document.getElementById('resume-pdf-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  let pdfDoc = null;
  let pageNum = 1;
  let pageRendering = false;
  let pageNumPending = null;

  // Simple approach: iframe for viewing, GitHub for download
  const pdfViewUrl = 'https://pub-896246ffffb148728a685d63cc7960d2.r2.dev/resume_arjun-8.pdf'; // Cloudflare CDN for viewing
  const downloadUrl = 'https://pub-896246ffffb148728a685d63cc7960d2.r2.dev/resume_arjun-8.pdf'; // Same URL for download

  // Configure PDF.js worker
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Check if PDF.js is loaded
  const checkPdfJs = () => {
    if (typeof pdfjsLib === 'undefined') {
      console.error('PDF.js library not loaded');
      if (resumeLoader) {
        resumeLoader.innerHTML = '<p style="color: #ef4444;">PDF viewer failed to load. Please use the download button.</p>';
      }
      return false;
    }
    return true;
  };

  const renderPage = (num) => {
    pageRendering = true;
    
    pdfDoc.getPage(num).then((page) => {
      const container = document.getElementById('resume-viewer-container');
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate scale based on device width with higher DPI for crisp rendering
      const viewport = page.getViewport({ scale: 1.0 });
      const isMobile = window.innerWidth <= 768;
      
      let scale;
      if (isMobile) {
        // On mobile: fit full page width with high DPI
        const scaleWidth = (containerWidth * 0.95) / viewport.width;
        scale = Math.max(scaleWidth, 1.5); // Minimum 1.5x for crisp text
      } else {
        // On desktop: show 70% of page height with high DPI
        const scaleHeight = (containerHeight / viewport.height) * 0.7;
        const scaleWidth = containerWidth / viewport.width;
        scale = Math.max(Math.min(scaleWidth, scaleHeight), 1.8); // Minimum 1.8x for crisp text
      }

      const scaledViewport = page.getViewport({ scale });

      // Set canvas size with high DPI
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.height = scaledViewport.height * devicePixelRatio;
      canvas.width = scaledViewport.width * devicePixelRatio;
      
      // Scale the canvas back down using CSS
      canvas.style.height = scaledViewport.height + 'px';
      canvas.style.width = scaledViewport.width + 'px';
      
      // Scale the drawing context so everything draws at the higher resolution
      ctx.scale(devicePixelRatio, devicePixelRatio);

      const renderContext = {
        canvasContext: ctx,
        viewport: scaledViewport
      };

      const renderTask = page.render(renderContext);

      renderTask.promise.then(() => {
        pageRendering = false;
        if (pageNumPending !== null) {
          renderPage(pageNumPending);
          pageNumPending = null;
        }
        
        // Hide loader after first render
        if (resumeLoader && num === 1) {
          setTimeout(() => {
            resumeLoader.style.opacity = '0';
            setTimeout(() => {
              resumeLoader.style.display = 'none';
            }, 300);
          }, 300);
        }
      });
    });

    // Update page counters
    const pageNumEl = document.getElementById('page-num');
    if (pageNumEl) {
      pageNumEl.textContent = num;
    }
  };

  const queueRenderPage = (num) => {
    if (pageRendering) {
      pageNumPending = num;
    } else {
      renderPage(num);
    }
  };

  const onPrevPage = () => {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
    updatePageButtons();
  };

  const onNextPage = () => {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
    updatePageButtons();
  };

  const updatePageButtons = () => {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
      prevBtn.disabled = pageNum <= 1;
    }
    if (nextBtn && pdfDoc) {
      nextBtn.disabled = pageNum >= pdfDoc.numPages;
    }
  };

  // For iframe fallback, track page manually
  let iframePage = 1;
  const iframeMaxPages = 2;

  const updateIframePageButtons = () => {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageNumEl = document.getElementById('page-num');
    
    if (prevBtn) prevBtn.disabled = iframePage <= 1;
    if (nextBtn) nextBtn.disabled = iframePage >= iframeMaxPages;
    if (pageNumEl) pageNumEl.textContent = iframePage;
  };

  const navigateIframePage = (direction) => {
    const fallbackIframe = document.getElementById('resume-pdf-iframe-fallback');
    if (!fallbackIframe || !fallbackIframe.src) return;
    
    if (direction === 'next' && iframePage < iframeMaxPages) {
      iframePage++;
    } else if (direction === 'prev' && iframePage > 1) {
      iframePage--;
    }
    
    // Use the PDF view URL for navigation
    const baseUrl = pdfViewUrl;
    
    // Mobile gets simplified URL for better native controls, desktop gets custom zoom
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      fallbackIframe.src = `${baseUrl}#page=${iframePage}&view=FitH`;
    } else {
      fallbackIframe.src = `${baseUrl}#page=${iframePage}&toolbar=0&navpanes=0&scrollbar=1&zoom=85`;
    }
    
    updateIframePageButtons();
  };

  const loadPDFInIframe = () => {
    console.log('Loading PDF in iframe viewer');
    const fallbackIframe = document.getElementById('resume-pdf-iframe-fallback');
    const canvasContainer = document.querySelector('.resume-canvas-container');
    const pageControls = document.querySelector('.resume-page-controls');
    
    if (fallbackIframe && canvasContainer) {
      // Hide canvas, show iframe
      canvasContainer.style.display = 'none';
      fallbackIframe.style.display = 'block';
      
      // Use Cloudflare CDN for viewing (best quality)
      const currentUrl = pdfViewUrl;
      // Mobile: use page-width for better mobile viewing with zoom enabled
      // Desktop: use 85% zoom for better quality
      const isMobile = window.innerWidth <= 768;
      
      // For mobile: simpler URL without zoom parameter to allow native browser controls
      // This enables pinch-to-zoom and proper mobile rendering
      if (isMobile) {
        fallbackIframe.src = `${currentUrl}#page=1&view=FitH`;
      } else {
        fallbackIframe.src = `${currentUrl}#page=1&toolbar=0&navpanes=0&scrollbar=1&zoom=85`;
      }
      
      console.log(`Loading iframe with URL: ${currentUrl}`);
      
      // Simple load handler - PDFs in iframes usually work
      const onIframeLoad = () => {
        console.log('Iframe loaded successfully');
        
        // Hide the loader after iframe loads
        setTimeout(() => {
          if (resumeLoader) {
            resumeLoader.style.opacity = '0';
            setTimeout(() => {
              resumeLoader.style.display = 'none';
            }, 300);
          }
        }, 1000);
      };
      
      // Error handler - if iframe fails, show download option
      const onIframeError = () => {
        console.warn('Iframe failed, showing download option');
        if (resumeLoader) {
          resumeLoader.innerHTML = `
            <div style="text-align: center; color: var(--text-muted);">
              <p>Unable to load PDF viewer.</p>
              <p style="margin: 16px 0;">Click below to download the resume:</p>
              <a href="${downloadUrl}" target="_blank" style="color: var(--accent); text-decoration: none; border: 1px solid var(--accent); padding: 8px 16px; border-radius: 8px; display: inline-block;">
                Download Resume PDF
              </a>
            </div>
          `;
        }
      };
      
      fallbackIframe.addEventListener('load', onIframeLoad, { once: true });
      fallbackIframe.addEventListener('error', onIframeError, { once: true });
      
      // Show page controls for 2-page resume
      if (pageControls) {
        pageControls.style.opacity = '1';
      }
      
      // Set flag that we're using iframe
      window.usingIframeFallback = true;
      updateIframePageButtons();
    }
  };

  const loadPDF = () => {
    // Simple approach: just use iframe directly
    loadPDFInIframe();
  };

  const openResumeModal = () => {
    // Close mobile nav if it's open
    if (document.body.classList.contains('mobile-nav-open')) {
      document.body.classList.remove('mobile-nav-open');
      if (hamburgerBtn) {
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      }
    }
    
    // Track resume view
    if (typeof window.trackResumeEvent === 'function') {
      window.trackResumeEvent('view_opened');
    }
    
    // On mobile, open PDF directly in browser's native viewer for best experience
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      window.open(pdfViewUrl, '_blank');
      if (typeof window.trackResumeEvent === 'function') {
        window.trackResumeEvent('mobile_view');
      }
      return; // Don't open modal on mobile
    }
    
    resumeModal.classList.add('is-open');
    // Fix for Clarity: Only hide vertical overflow, keep horizontal as is
    document.body.style.overflowY = 'hidden';
    
    // Load PDF when modal opens (if not already loaded)
    if (!pdfDoc) {
      setTimeout(loadPDF, 100); // Small delay to ensure modal is rendered
    }
  };

  const closeResumeModal = () => {
    resumeModal.classList.remove('is-open');
    // Fix for Clarity: Restore to CSS default (auto)
    document.body.style.overflowY = '';
    
    // Track resume close
    if (typeof window.trackResumeEvent === 'function') {
      window.trackResumeEvent('view_closed');
    }
  };

  // Event listeners for opening modal
  if (viewResumeBtn) {
    viewResumeBtn.addEventListener('click', openResumeModal);
  }
  
  if (viewResumeMobileBtn) {
    viewResumeMobileBtn.addEventListener('click', openResumeModal);
  }
  
  const viewResumeFooterBtn = document.getElementById('view-resume-footer-btn');
  if (viewResumeFooterBtn) {
    viewResumeFooterBtn.addEventListener('click', openResumeModal);
  }

  // Event listeners for closing modal
  if (resumeModalClose) {
    resumeModalClose.addEventListener('click', closeResumeModal);
  }

  if (resumeModalOverlay) {
    resumeModalOverlay.addEventListener('click', closeResumeModal);
  }

  // Download button using GitHub raw link
  const downloadResumeBtn = document.getElementById('download-resume-btn');
  if (downloadResumeBtn) {
    downloadResumeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Track resume download
      if (typeof window.trackResumeEvent === 'function') {
        window.trackResumeEvent('download_clicked');
      }
      
      // Open GitHub raw download link in new tab
      window.open(downloadUrl, '_blank');
    });
  }

  // Page navigation with iframe fallback support
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (window.usingIframeFallback) {
        navigateIframePage('prev');
      } else {
        onPrevPage();
      }
    });
  }
  
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (window.usingIframeFallback) {
        navigateIframePage('next');
      } else {
        onNextPage();
      }
    });
  }

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && resumeModal.classList.contains('is-open')) {
      closeResumeModal();
    }
  });

  // Re-render on window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    if (resumeModal.classList.contains('is-open') && pdfDoc) {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        renderPage(pageNum);
      }, 250);
    }
  });
})();