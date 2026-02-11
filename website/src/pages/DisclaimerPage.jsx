import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Scale, FileWarning, Gavel, Users, ChevronRight } from 'lucide-react';

export const DisclaimerPage = () => {
  const lastUpdated = "February 11, 2025";

  return (
    <div className="pt-24 pb-16" data-testid="disclaimer-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600/20 to-orange-600/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Legal <span className="gradient-text">Disclaimer</span>
          </h1>
          <p className="text-gray-400">
            Last updated: {lastUpdated}
          </p>
        </motion.div>

        {/* Critical Warning Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-12 p-8 rounded-2xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border-2 border-red-500/50"
        >
          <div className="flex items-center gap-4 mb-4">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <h2 className="text-2xl font-bold text-red-400">READ BEFORE USE</h2>
          </div>
          <p className="text-lg text-gray-200">
            WatchNexus is provided as a media organization and management tool only. 
            <strong className="text-white"> The developers, contributors, and distributors of WatchNexus 
            assume NO responsibility for how the software is used or for any content accessed, 
            downloaded, uploaded, stored, or distributed using this software.</strong>
          </p>
        </motion.div>

        {/* Main Disclaimer Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-8"
        >
          {/* No Liability for Content */}
          <section className="p-6 rounded-xl bg-surface border border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <FileWarning className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">No Liability for User Content</h3>
                <p className="text-gray-300 mb-4">
                  WatchNexus and its developers, maintainers, contributors, and affiliates:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-300">
                      <strong className="text-white">DO NOT host, store, or provide</strong> any media files, 
                      torrents, NZB files, IPTV streams, or any other content
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-300">
                      <strong className="text-white">ARE NOT responsible for</strong> the legality, copyright status, 
                      or appropriateness of any files downloaded, streamed, or accessed using this software
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-300">
                      <strong className="text-white">DO NOT control or monitor</strong> what indexers, trackers, 
                      sources, or IPTV playlists users choose to configure
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-300">
                      <strong className="text-white">CANNOT be held liable</strong> for any copyright infringement, 
                      legal violations, or damages resulting from user actions
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* User Responsibility */}
          <section className="p-6 rounded-xl bg-surface border border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">User Responsibility</h3>
                <p className="text-gray-300 mb-4">
                  As a user of WatchNexus, <strong className="text-white">YOU are solely responsible for:</strong>
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">→</span>
                    <span className="text-gray-300">
                      Ensuring all content you access, download, or stream is legally obtained and you have the 
                      right to access it in your jurisdiction
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">→</span>
                    <span className="text-gray-300">
                      Complying with all applicable local, state, national, and international laws, including 
                      copyright laws and intellectual property regulations
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">→</span>
                    <span className="text-gray-300">
                      Understanding that downloading copyrighted content without authorization is illegal in 
                      most jurisdictions and may result in civil or criminal penalties
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">→</span>
                    <span className="text-gray-300">
                      Any consequences, legal or otherwise, arising from your use of the software
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Legal Purpose Statement */}
          <section className="p-6 rounded-xl bg-surface border border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Scale className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">Intended Purpose</h3>
                <p className="text-gray-300 mb-4">
                  WatchNexus is designed and intended for the following <strong className="text-white">legal purposes only:</strong>
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">
                      Organizing and managing your personal, legally-owned media collection
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">
                      Streaming media files stored on your own devices within your home network
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">
                      Downloading content that is freely and legally available (public domain, Creative Commons, 
                      authorized distributions)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">
                      Accessing IPTV streams that you are legally authorized to view
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">
                      Educational and development purposes in understanding media management systems
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* No Endorsement */}
          <section className="p-6 rounded-xl bg-surface border border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Gavel className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">No Endorsement of Illegal Activity</h3>
                <p className="text-gray-300 mb-4">
                  WatchNexus and its developers <strong className="text-white">do not encourage, endorse, 
                  promote, or condone</strong> the use of this software for:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-300">Downloading or distributing copyrighted material without authorization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-300">Circumventing digital rights management (DRM) protections</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-300">Accessing pirated IPTV streams or unauthorized broadcasts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-300">Any activity that violates applicable laws or third-party rights</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* DMCA & Takedowns */}
          <section className="p-6 rounded-xl bg-surface border border-white/10">
            <h3 className="text-xl font-bold mb-3">Copyright Complaints & DMCA</h3>
            <p className="text-gray-300 mb-4">
              WatchNexus is a software tool that does not host any content. We cannot respond to DMCA takedown 
              requests or copyright complaints regarding content accessed through the software because:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li>• We do not host, store, or have access to any user content</li>
              <li>• Content sources are configured entirely by individual users</li>
              <li>• We have no visibility into what content users access</li>
            </ul>
            <p className="text-gray-300 mt-4">
              If you are a copyright holder and believe your content is being infringed, please contact the 
              relevant hosting service, indexer, or content source directly.
            </p>
          </section>

          {/* Assumption of Risk */}
          <section className="p-6 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30">
            <h3 className="text-xl font-bold mb-3 text-red-400">Assumption of Risk</h3>
            <p className="text-gray-200">
              By downloading, installing, and using WatchNexus, you expressly acknowledge and agree that:
            </p>
            <ul className="mt-4 space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">1.</span>
                <span>You use the software entirely at your own risk</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">2.</span>
                <span>You assume all responsibility for compliance with applicable laws</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">3.</span>
                <span>You will not hold WatchNexus or its developers liable for any damages, legal issues, 
                or consequences arising from your use of the software</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">4.</span>
                <span>This disclaimer constitutes a complete defense to any claims made against WatchNexus 
                or its developers regarding user conduct</span>
              </li>
            </ul>
          </section>

          {/* Jurisdiction Notice */}
          <section className="p-6 rounded-xl bg-surface border border-white/10">
            <h3 className="text-xl font-bold mb-3">Jurisdictional Notice</h3>
            <p className="text-gray-300">
              Laws regarding downloading, streaming, and sharing media content vary by jurisdiction. 
              What may be legal in one country may be illegal in another. It is your responsibility to 
              understand and comply with the laws applicable in your jurisdiction. WatchNexus makes no 
              representations regarding the legality of using the software in any particular jurisdiction.
            </p>
          </section>
        </motion.div>

        {/* Acceptance Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-8 rounded-2xl glass text-center"
        >
          <h3 className="text-xl font-bold mb-4">Acceptance of Disclaimer</h3>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            By downloading, installing, or using WatchNexus, you confirm that you have read, understood, 
            and agree to be bound by this Legal Disclaimer and our Terms & Conditions.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/terms"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5"
            >
              View Terms & Conditions
              <ChevronRight className="w-4 h-4" />
            </a>
            <a
              href="/download"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-medium"
            >
              I Understand - Proceed to Download
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </motion.div>

        {/* Last Resort Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center text-sm text-gray-500"
        >
          <p>
            If you do not agree with any part of this disclaimer or the Terms & Conditions, 
            please do not download, install, or use the WatchNexus software.
          </p>
        </motion.div>
      </div>
    </div>
  );
};
