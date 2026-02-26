import { Sidebar } from './Sidebar';
import { motion } from 'framer-motion';

export const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      {/* Brand glow effect */}
      <div className="fixed inset-0 brand-glow pointer-events-none" />
      
      <Sidebar />
      
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="ml-[72px] lg:ml-[240px] min-h-screen transition-all duration-200"
      >
        {children}
      </motion.main>
    </div>
  );
};
