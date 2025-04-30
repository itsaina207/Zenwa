document.addEventListener('DOMContentLoaded', function() {
    // Navigation scroll effect
    const nav = document.querySelector('nav');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            nav.style.backgroundColor = 'rgba(0, 17, 43, 0.95)';
        } else {
            nav.style.backgroundColor = 'rgba(0, 17, 43, 0.9)';
        }
    });

    // Mobile Navigation
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const body = document.body;
    
    if (menuToggle) {
        // Create mobile menu elements if they don't exist
        if (!document.querySelector('.mobile-nav')) {
            const mobileNav = document.createElement('div');
            mobileNav.className = 'mobile-nav';
            
            const closeMenu = document.createElement('div');
            closeMenu.className = 'close-menu';
            closeMenu.innerHTML = '<i class="fas fa-times"></i>';
            
            const mobileNavLinks = document.createElement('div');
            mobileNavLinks.className = 'mobile-nav-links';
            
            // Clone navigation links
            const navLinks = document.querySelector('.nav-links').cloneNode(true);
            const links = navLinks.querySelectorAll('a');
            
            links.forEach(link => {
                mobileNavLinks.appendChild(link.cloneNode(true));
            });
            
            mobileNav.appendChild(closeMenu);
            mobileNav.appendChild(mobileNavLinks);
            
            const overlay = document.createElement('div');
            overlay.className = 'mobile-nav-overlay';
            
            body.appendChild(mobileNav);
            body.appendChild(overlay);
            
            // Close menu function
            function closeMenuFunc() {
                mobileNav.classList.remove('active');
                overlay.classList.remove('active');
                body.style.overflow = '';
            }
            
            // Event listeners
            closeMenu.addEventListener('click', closeMenuFunc);
            overlay.addEventListener('click', closeMenuFunc);
            
            // Close menu when clicking a nav link
            const mobileLinks = mobileNavLinks.querySelectorAll('a');
            mobileLinks.forEach(link => {
                link.addEventListener('click', closeMenuFunc);
            });
        }
        
        const mobileNav = document.querySelector('.mobile-nav');
        const overlay = document.querySelector('.mobile-nav-overlay');
        
        // Toggle menu
        menuToggle.addEventListener('click', function() {
            mobileNav.classList.add('active');
            overlay.classList.add('active');
            body.style.overflow = 'hidden';
        });
    }

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // Open first FAQ by default
    if (faqItems.length > 0) {
        faqItems[0].classList.add('active');
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.getBoundingClientRect().top + window.pageYOffset;
                
                window.scrollTo({
                    top: offsetTop - 80, // Offset for fixed header
                    behavior: 'smooth'
                });
            }
        });
    });

    // Animation on Scroll
    const animateElements = document.querySelectorAll('.feature-card, .use-case-card, .step, .testimonial, .problem-box, .solution-box');
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });

    // Create SVG placeholder for logo if image is missing
    const logoImages = document.querySelectorAll('.nav-logo img, .footer-logo img');
    
    logoImages.forEach(img => {
        img.onerror = function() {
            const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgElement.setAttribute('width', '120');
            svgElement.setAttribute('height', '40');
            svgElement.setAttribute('viewBox', '0 0 120 40');
            svgElement.style.display = 'block';
            
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', '40');
            rect.setAttribute('height', '40');
            rect.setAttribute('fill', '#0066FF');
            rect.setAttribute('rx', '8');
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '50');
            text.setAttribute('y', '25');
            text.setAttribute('font-family', 'Inter, sans-serif');
            text.setAttribute('font-size', '18');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', 'white');
            text.textContent = 'Zenwa';
            
            const innerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            innerText.setAttribute('x', '20');
            innerText.setAttribute('y', '25');
            innerText.setAttribute('font-family', 'Inter, sans-serif');
            innerText.setAttribute('font-size', '18');
            innerText.setAttribute('font-weight', 'bold');
            innerText.setAttribute('fill', 'white');
            innerText.textContent = 'Z';
            
            svgElement.appendChild(rect);
            svgElement.appendChild(text);
            svgElement.appendChild(innerText);
            
            this.parentNode.replaceChild(svgElement, this);
        };
    });

    // Create placeholder for missing illustrations
    const illustrations = document.querySelectorAll('.main-illustration, .step img, .problem-box img, .solution-box img');
    
    illustrations.forEach(img => {
        img.onerror = function() {
            const placeholder = document.createElement('div');
            placeholder.className = 'illustration-placeholder';
            placeholder.style.width = '100%';
            placeholder.style.height = '200px';
            placeholder.style.backgroundColor = '#f0f5ff';
            placeholder.style.borderRadius = '12px';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.style.color = '#0066FF';
            placeholder.style.fontWeight = 'bold';
            
            // Get alt text or default text
            const altText = this.alt || 'Zenwa Illustration';
            placeholder.textContent = altText;
            
            this.parentNode.replaceChild(placeholder, this);
        };
    });

    // Placeholders for preview thumbnails
    const previewImages = document.querySelectorAll('.preview');
    
    previewImages.forEach((img, index) => {
        img.onerror = function() {
            const placeholder = document.createElement('div');
            placeholder.className = 'preview-placeholder';
            placeholder.style.width = '120px';
            placeholder.style.height = '200px';
            placeholder.style.backgroundColor = '#e6efff';
            placeholder.style.borderRadius = '10px';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.style.color = '#0066FF';
            placeholder.style.fontSize = '0.8rem';
            placeholder.style.textAlign = 'center';
            placeholder.style.padding = '10px';
            
            // Different text for each placeholder
            const texts = [
                'Balance & Tokens', 
                'Send & Receive', 
                'Natural Language'
            ];
            
            placeholder.textContent = texts[index % texts.length];
            
            this.parentNode.replaceChild(placeholder, this);
        };
    });
});