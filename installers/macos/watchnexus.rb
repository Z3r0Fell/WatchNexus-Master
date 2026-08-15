class WatchNexus < Formula
  desc "Self-hosted media management pipeline"
  homepage "https://watchnexus.ca"
  url "https://github.com/Z3r0Fell/WatchNexus-Master/archive/refs/tags/v1.0.1.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "LicenseRef-OWN"
  version "1.0.1"

  depends_on "dotnet@10" => :build

  def install
    system "dotnet", "build", "src/watchnexus/core/WatchNexus.Core.csproj", "-c", "Release", "--no-self-contained"
    bin.install "src/watchnexus/core/bin/Release/net10.0/WatchNexus.Core" => "watchnexus"
  end

  service do
    run [opt_bin/"watchnexus", "--urls", "http://0.0.0.0:8001"]
    keep_alive true
    working_dir var
  end

  test do
    system bin/"watchnexus", "--help"
  end
end
