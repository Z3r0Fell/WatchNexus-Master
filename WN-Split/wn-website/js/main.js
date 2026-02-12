/* WatchNexus Website - Simple JavaScript */

// FAQ Accordion
document.addEventListener('DOMContentLoaded', function() {
  // FAQ toggle
  document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', function() {
      const item = this.closest('.faq-item');
      const wasActive = item.classList.contains('active');
      
      // Close all other FAQs
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      
      // Toggle current
      if (!wasActive) {
        item.classList.add('active');
      }
    });
  });

  // Mobile menu toggle
  const mobileBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.navbar-links');
  
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', function() {
      navLinks.classList.toggle('mobile-visible');
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Fade in elements on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.card, .feature-card, .download-card').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
});

// Copy to clipboard function
function copyCode(button) {
  const code = button.previousElementSibling;
  navigator.clipboard.writeText(code.textContent).then(() => {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => button.textContent = originalText, 2000);
  });
}
