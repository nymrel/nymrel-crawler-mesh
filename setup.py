from setuptools import setup, find_packages

setup(
    name="nymrel_crawler_mesh",
    version="1.0.0",
    description="High-throughput, zero-telemetry web crawler & clean markdown/JSON extractor built for AI agents and LLMs",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="Nymrel / JalenBuilds LLC",
    author_email="contact@nymrel.com",
    url="https://github.com/nymrel/nymrel-crawler-mesh",
    license="MIT",
    package_dir={"": "python"},
    packages=find_packages(where="python"),
    python_requires=">=3.9",
    install_requires=[],
    entry_points={
        "console_scripts": [
            "crawler-mesh-py=nymrel_crawler_mesh.cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Topic :: Internet :: WWW/HTTP :: Indexing/Search",
        "Topic :: Text Processing :: Markup :: Markdown",
    ],
)
