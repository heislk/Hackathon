import { useState } from "react";
import Navbar from '../components/Navbar'

function RiskScan() {
  // ChatGPT
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }
    alert(`File "${file.name}" uploaded successfully!`);
  };

  return (
    <>
    <Navbar />
    {/* ChatGPT */}
      <section id="upload" className="upload-section">
        <h2>Upload File for Security Scan</h2>
        <p>
          Upload smart contracts, transaction files, or documents for analysis.
        </p>

        <input type="file" onChange={handleFileChange} />
        <button className="primary-btn" onClick={handleUpload}>
          Upload & Scan
        </button>
      </section>
    </>
  );
}

export default RiskScan;
