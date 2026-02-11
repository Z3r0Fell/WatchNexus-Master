import { motion } from 'framer-motion';
import { FileText, AlertTriangle, Scale, Shield, ChevronRight } from 'lucide-react';

export const TermsPage = () => {
  const lastUpdated = "February 11, 2025";

  return (
    <div className="pt-24 pb-16" data-testid="terms-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Terms & <span className="gradient-text">Conditions</span>
          </h1>
          <p className="text-gray-400">
            Last updated: {lastUpdated}
          </p>
        </motion.div>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-12 p-6 rounded-2xl bg-orange-500/10 border border-orange-500/30"
        >
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-bold text-orange-400 mb-2">Important Notice</h2>
              <p className="text-gray-300">
                By downloading, installing, or using WatchNexus software, you acknowledge that you have read, 
                understood, and agree to be bound by these Terms and Conditions. If you do not agree to these 
                terms, do not download, install, or use the software.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Terms Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="prose prose-invert max-w-none space-y-8"
        >
          {/* Section 1 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">1</span>
              Acceptance of Terms
            </h2>
            <p className="text-gray-300 mb-4">
              These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") 
              and WatchNexus ("we," "us," or "our") governing your use of the WatchNexus software application and all related 
              services (collectively, the "Software").
            </p>
            <p className="text-gray-300">
              Your access to and use of the Software is conditioned on your acceptance of and compliance with these Terms. 
              These Terms apply to all visitors, users, and others who access or use the Software.
            </p>
          </section>

          {/* Section 2 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">2</span>
              Nature of the Software
            </h2>
            <p className="text-gray-300 mb-4">
              WatchNexus is a self-hosted media management and organization tool. The Software provides functionality for:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Organizing and cataloging personal media files</li>
              <li>Streaming media within your local network</li>
              <li>Managing metadata for media content</li>
              <li>Downloading files from various sources via user-configured indexers</li>
              <li>IPTV playlist management and playback</li>
            </ul>
            <p className="text-gray-300 mt-4">
              <strong className="text-white">The Software is a tool only.</strong> WatchNexus does not host, store, distribute, 
              or provide any media content. All content accessed through the Software is obtained from third-party sources 
              configured by the User.
            </p>
          </section>

          {/* Section 3 - Critical Disclaimer */}
          <section className="p-6 rounded-xl bg-red-500/10 border border-red-500/30">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400">
              <span className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-sm">3</span>
              Disclaimer of Liability for User Content
            </h2>
            <p className="text-gray-300 mb-4">
              <strong className="text-white">WATCHNEXUS AND ITS DEVELOPERS, CONTRIBUTORS, AND AFFILIATES ARE NOT RESPONSIBLE FOR:</strong>
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Any files downloaded, uploaded, stored, streamed, or otherwise handled using the Software</li>
              <li>The content, legality, accuracy, or appropriateness of any media accessed through the Software</li>
              <li>Any third-party indexers, trackers, sources, or services configured or used by the User</li>
              <li>Any IPTV streams, playlists, or channels added by the User</li>
              <li>Any copyright, trademark, or intellectual property infringement resulting from User actions</li>
              <li>Any illegal activities conducted using the Software</li>
            </ul>
            <p className="text-gray-300 mt-4">
              <strong className="text-red-400">YOU ARE SOLELY RESPONSIBLE</strong> for ensuring that your use of the Software 
              complies with all applicable local, state, national, and international laws and regulations, including but not 
              limited to copyright laws, intellectual property rights, and data protection regulations.
            </p>
          </section>

          {/* Section 4 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">4</span>
              User Responsibilities
            </h2>
            <p className="text-gray-300 mb-4">By using the Software, you agree to:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Use the Software only for lawful purposes and in accordance with these Terms</li>
              <li>Not use the Software to download, distribute, or access copyrighted material without proper authorization</li>
              <li>Not use the Software for any illegal, harmful, or unauthorized purpose</li>
              <li>Comply with all applicable laws regarding the transmission of data and content</li>
              <li>Be solely responsible for all content you access, download, or distribute using the Software</li>
              <li>Not hold WatchNexus liable for any consequences arising from your use of the Software</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">5</span>
              No Warranty
            </h2>
            <p className="text-gray-300 mb-4">
              THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
              INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, 
              NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
            </p>
            <p className="text-gray-300">
              WatchNexus does not warrant that: (a) the Software will function uninterrupted, secure, or error-free; 
              (b) the results obtained from the Software will be accurate or reliable; (c) any errors in the Software 
              will be corrected; or (d) the Software will meet your requirements.
            </p>
          </section>

          {/* Section 6 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">6</span>
              Limitation of Liability
            </h2>
            <p className="text-gray-300 mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WATCHNEXUS, ITS DEVELOPERS, 
              CONTRIBUTORS, LICENSORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, 
              PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Loss of profits, revenue, data, or goodwill</li>
              <li>Service interruption or computer damage</li>
              <li>Cost of substitute products or services</li>
              <li>Legal fees, fines, or penalties arising from User conduct</li>
              <li>Any other intangible losses</li>
            </ul>
            <p className="text-gray-300 mt-4">
              This limitation applies regardless of the legal theory upon which damages are sought, whether in contract, 
              tort (including negligence), strict liability, or otherwise, even if WatchNexus has been advised of the 
              possibility of such damages.
            </p>
          </section>

          {/* Section 7 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">7</span>
              Indemnification
            </h2>
            <p className="text-gray-300">
              You agree to defend, indemnify, and hold harmless WatchNexus, its developers, contributors, licensors, 
              and affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, 
              debts, and expenses (including but not limited to attorney's fees) arising from: (a) your use of the 
              Software; (b) your violation of these Terms; (c) your violation of any third-party right, including 
              without limitation any copyright, trademark, property, or privacy right; or (d) any claim that your 
              use of the Software caused damage to a third party.
            </p>
          </section>

          {/* Section 8 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">8</span>
              Third-Party Services
            </h2>
            <p className="text-gray-300 mb-4">
              The Software may allow you to configure and connect to third-party services, indexers, trackers, and 
              content sources. WatchNexus has no control over and assumes no responsibility for the content, privacy 
              policies, or practices of any third-party services.
            </p>
            <p className="text-gray-300">
              You acknowledge and agree that WatchNexus shall not be responsible or liable, directly or indirectly, 
              for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance 
              on any third-party content, goods, or services.
            </p>
          </section>

          {/* Section 9 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">9</span>
              Intellectual Property
            </h2>
            <p className="text-gray-300 mb-4">
              WatchNexus software is released under the MIT License. You are free to use, copy, modify, merge, 
              publish, distribute, sublicense, and/or sell copies of the Software, subject to the terms of the 
              MIT License.
            </p>
            <p className="text-gray-300">
              The WatchNexus name, logo, and branding are trademarks of WatchNexus. You may not use these marks 
              without prior written permission, except as reasonably necessary to describe the origin of the Software.
            </p>
          </section>

          {/* Section 10 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">10</span>
              Modifications to Terms
            </h2>
            <p className="text-gray-300">
              We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision 
              is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes 
              a material change will be determined at our sole discretion. By continuing to access or use the Software 
              after those revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>

          {/* Section 11 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">11</span>
              Governing Law
            </h2>
            <p className="text-gray-300">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which 
              you reside, without regard to its conflict of law provisions. Any legal action or proceeding arising 
              under these Terms will be brought exclusively in the courts of competent jurisdiction in your jurisdiction, 
              and you hereby consent to the personal jurisdiction and venue therein.
            </p>
          </section>

          {/* Section 12 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">12</span>
              Severability
            </h2>
            <p className="text-gray-300">
              If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed 
              and interpreted to accomplish the objectives of such provision to the greatest extent possible under 
              applicable law, and the remaining provisions will continue in full force and effect.
            </p>
          </section>

          {/* Section 13 */}
          <section className="p-6 rounded-xl glass">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">13</span>
              Contact Information
            </h2>
            <p className="text-gray-300">
              If you have any questions about these Terms, please contact us through our GitHub repository at{' '}
              <a href="https://github.com/watchnexus/watchnexus" className="text-violet-400 hover:underline">
                github.com/watchnexus/watchnexus
              </a>.
            </p>
          </section>
        </motion.div>

        {/* Acceptance Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-white/10 text-center"
        >
          <p className="text-gray-300 mb-4">
            By downloading, installing, or using WatchNexus, you acknowledge that you have read these Terms and Conditions 
            and agree to be bound by them.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/download"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-medium"
            >
              I Accept - Download
              <ChevronRight className="w-4 h-4" />
            </a>
            <a
              href="/disclaimer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5"
            >
              <Shield className="w-4 h-4" />
              View Legal Disclaimer
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
