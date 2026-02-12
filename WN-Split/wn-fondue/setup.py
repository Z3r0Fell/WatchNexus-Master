from setuptools import setup, find_packages

setup(
    name="wn-fondue",
    version="1.0.0",
    description="WatchNexus Torrent Engine",
    author="WatchNexus Team",
    author_email="team@watchnexus.com",
    url="https://github.com/WatchNexus/wn-fondue",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "wn-core>=1.0.0"
    ],
    python_requires=">=3.9",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
