import React, { useState } from 'react';
import { getFileNamev2 } from '../../../../utils/helper/FilenameURL';

const IngestFilesStage = ({
    job,
    onUploadClick,
    onFileUpload,
    fileInputRef,
    onDownload,
    onDelete,
    isSalesPerson
}) => {
    const [selectedTag, setSelectedTag] = useState('');
    const [previewFile, setPreviewFile] = useState(null);

    // Get material group names from job
    const materialGroups = job.job_sheet?.materialprocess?.map(group => group.material_group_name) || [];

    // Define standard tags
    const standardTags = [
        { label: 'Artwork PDF', value: 'artwork_pdf' },
        { label: 'Artwork CDR', value: 'artwork_cdr' },
        { label: 'Note', value: 'note' },
        { label: 'Logo', value: 'logo' },
        { label: 'Signed Image', value: 'signed_image' },
    ];

    // Combine standard tags with material group tags
    const allTags = [
        ...standardTags,
        ...materialGroups.map(name => ({ label: `Section: ${name}`, value: name }))
    ];

    // Format artwork files from BOM (PDF and CDR)
    const artworkFiles = [];
    const pdfUrl = job.bom_id?.artwork_pdf || job.artwork_pdf;
    const cdrUrl = job.bom_id?.artwork_cdr || job.artwork_cdr;

    if (pdfUrl) {
        artworkFiles.push({
            name: getFileNamev2(pdfUrl),
            url: pdfUrl,
            isUploaded: true,
            type: 'PDF',
            tag: 'Artwork PDF'
        });
    }
    if (cdrUrl) {
        artworkFiles.push({
            name: getFileNamev2(cdrUrl),
            url: cdrUrl,
            isUploaded: true,
            type: 'CDR',
            tag: 'Artwork CDR'
        });
    }

    // Format additional files uploaded from DTP / Enquiry / Sales Order
    const sourceAdditionalFiles = job.additional_files?.length > 0
        ? job.additional_files
        : (job.sample_order_id?.additional_files || []);

    const additionalFiles = sourceAdditionalFiles.length > 0
        ? sourceAdditionalFiles.map(item => {
            const fileUrl = typeof item === 'string' ? item : (item.file_url || item.url);
            const rawTagName = typeof item === 'string' ? null : (item.tag_name || item.tag);
            const fileId = typeof item === 'string' ? null : item._id;
            let sigName = typeof item === 'object' ? item.name : '';
            let sigDesig = typeof item === 'object' ? item.designation : '';

            // Extract Name/Designation from tag_name if embedded (e.g. "Signed Image - John Doe (CEO)")
            if (rawTagName && rawTagName.startsWith('Signed Image - ')) {
                const afterPrefix = rawTagName.replace('Signed Image - ', '').trim();
                const parenMatch = afterPrefix.match(/^(.+?)\s*\((.+?)\)$/);
                if (parenMatch) {
                    if (!sigName) sigName = parenMatch[1].trim();
                    if (!sigDesig) sigDesig = parenMatch[2].trim();
                } else if (!sigName) {
                    sigName = afterPrefix;
                }
            }

            const isSig = rawTagName === 'Signed Image' || (rawTagName && rawTagName.startsWith('Signed Image')) || !!sigName || !!sigDesig;
            const isLogo = rawTagName === 'Logo' || (rawTagName && rawTagName.toLowerCase().includes('logo'));

            let fileType = 'FILE';
            if (fileUrl) {
                const lower = fileUrl.toLowerCase();
                if (lower.endsWith('.pdf')) fileType = 'PDF';
                else if (lower.endsWith('.cdr')) fileType = 'CDR';
                else if (lower.match(/\.(jpg|jpeg|png|webp|gif|svg)$/)) fileType = isSig ? 'SIGNATURE' : (isLogo ? 'LOGO' : 'IMG');
            }
            if (isSig && fileType === 'FILE') fileType = 'SIGNATURE';

            return {
                name: sigName || getFileNamev2(fileUrl) || 'Attachment',
                signatoryName: sigName,
                designation: sigDesig,
                url: fileUrl,
                isUploaded: !!fileUrl,
                tag: rawTagName || (isSig ? 'Signed Image' : isLogo ? 'Logo' : 'Additional File'),
                type: fileType,
                _id: fileId
            };
        })
        : [];

    // Combine all files
    const allFiles = [...artworkFiles, ...additionalFiles];

    const handleFileChange = (e) => {
        onFileUpload(e, selectedTag);
    };

    const handleViewFile = (file) => {
        if (!file.url) return;
        setPreviewFile(file);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 font-primary">Ingest Files</h2>

            {/* Upload Section */}
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-6">
                <div className="flex flex-col items-center text-center">
                    <i className="fa-solid fa-cloud-arrow-up text-4xl text-slate-400 mb-3"></i>
                    <p className="text-sm text-slate-600 mb-3 font-primary">Upload additional artwork files</p>
                </div>

                <div className="max-w-md mx-auto space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider font-primary">Select Tag/Category</label>
                        <select
                            value={selectedTag}
                            onChange={(e) => setSelectedTag(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-primary"
                        >
                            <option value="">Select Tag</option>
                            {allTags.map((tag, idx) => (
                                <option key={idx} value={tag.value}>{tag.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={onUploadClick}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors font-primary w-full shadow-sm"
                        >
                            <i className="fa-solid fa-upload mr-2"></i>
                            Choose Files
                        </button>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept="*/*"
                    multiple
                />
            </div>

            {/* Existing Files List */}
            {allFiles.length > 0 ? (
                <div className="space-y-3">
                    {allFiles.map((file, index) => {
                        const isSignature = file.type === 'SIGNATURE' || !!file.signatoryName;
                        return (
                            <div key={index} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-medium text-slate-900 font-primary truncate max-w-[350px]" title={file.name}>
                                                {file.name}
                                            </span>
                                            {file.type === 'PDF' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-600">
                                                    PDF
                                                </span>
                                            )}
                                            {file.type === 'CDR' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">
                                                    CDR
                                                </span>
                                            )}
                                            {isSignature && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
                                                    Signature
                                                </span>
                                            )}
                                            {file.type === 'LOGO' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                                                    Logo
                                                </span>
                                            )}
                                            {!['PDF', 'CDR', 'SIGNATURE', 'LOGO'].includes(file.type) && file.tag && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-600">
                                                    {file.tag}
                                                </span>
                                            )}
                                        </div>
                                        {/* Signature Designation Details */}
                                        {isSignature && (
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-primary">
                                                {file.signatoryName && (
                                                    <span className="font-semibold text-slate-700">Signatory: {file.signatoryName}</span>
                                                )}
                                                {file.designation && (
                                                    <span className="text-slate-500">· Designation: <strong className="text-slate-700 font-medium">{file.designation}</strong></span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    {/* View Button */}
                                    {file.url && (
                                        <button
                                            onClick={() => handleViewFile(file)}
                                            title="View / Preview file"
                                            className="px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors font-primary border border-indigo-200 rounded hover:bg-indigo-50 flex items-center gap-1.5 shadow-2xs"
                                        >
                                            <i className="fa-solid fa-eye"></i>
                                            <span>View</span>
                                        </button>
                                    )}

                                    {/* Download Button */}
                                    <button
                                        onClick={() => onDownload(file)}
                                        title="Download file"
                                        className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors font-primary border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1.5"
                                    >
                                        <i className="fa-solid fa-download"></i>
                                        <span>Download</span>
                                    </button>

                                    {!(file.type === 'PDF' || file.type === 'CDR') && !isSalesPerson && (
                                        <button
                                            onClick={() => onDelete(file)}
                                            title="Delete file"
                                            className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors font-primary border border-red-200 rounded hover:bg-red-50 flex items-center gap-1.5"
                                        >
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8 text-slate-400 text-sm font-primary">
                    <i className="fa-regular fa-folder-open text-3xl mb-2"></i>
                    <p>No files uploaded yet</p>
                </div>
            )}

            {/* Ingest File Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm font-primary truncate max-w-[400px]">
                                    {previewFile.name}
                                </span>
                                {previewFile.type && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700">
                                        {previewFile.type}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setPreviewFile(null)}
                                className="text-slate-400 hover:text-slate-700 text-lg p-1"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex flex-col items-center justify-center bg-slate-100/50 min-h-[300px]">
                            {previewFile.type === 'PDF' ? (
                                <div className="w-full h-[500px] flex flex-col">
                                    <iframe
                                        src={previewFile.url}
                                        title={previewFile.name}
                                        className="w-full h-full rounded border border-slate-200 shadow-sm"
                                    />
                                    <div className="mt-2 text-right">
                                        <a
                                            href={previewFile.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-indigo-600 hover:underline font-semibold"
                                        >
                                            <i className="fa-solid fa-arrow-up-right-from-square mr-1"></i>
                                            Open in new tab
                                        </a>
                                    </div>
                                </div>
                            ) : previewFile.type === 'CDR' ? (
                                <div className="text-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm max-w-md w-full">
                                    <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                                        <i className="fa-solid fa-file-pen"></i>
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-base mb-1 font-primary">CorelDRAW Vector Artwork (.cdr)</h4>
                                    <p className="text-xs text-slate-500 mb-5 leading-relaxed font-primary">
                                        CDR files are vector source files designed for CorelDRAW plotter and CNC printing workflows. They cannot be rendered directly inside web browsers.
                                    </p>
                                    <button
                                        onClick={() => onDownload(previewFile)}
                                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                    >
                                        <i className="fa-solid fa-download mr-2"></i>
                                        Download CDR File
                                    </button>
                                </div>
                            ) : previewFile.type === 'SIGNATURE' || previewFile.signatoryName || previewFile.designation ? (
                                <div className="text-center p-6 bg-white rounded-xl border border-slate-200 shadow-sm max-w-md w-full">
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 mb-4 flex items-center justify-center min-h-[160px]">
                                        <img
                                            src={previewFile.url}
                                            alt={previewFile.signatoryName || "Signature"}
                                            className="max-h-40 max-w-full object-contain"
                                        />
                                    </div>
                                    <div className="border-t border-slate-100 pt-3 text-center">
                                        <h3 className="text-base font-bold text-slate-900 font-primary">
                                            {previewFile.signatoryName || previewFile.name}
                                        </h3>
                                        {previewFile.designation && (
                                            <p className="text-xs font-medium text-slate-500 mt-1 font-primary">
                                                {previewFile.designation}
                                            </p>
                                        )}
                                        <span className="inline-block mt-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                                            Verified Signatory Asset
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm max-w-md w-full flex items-center justify-center">
                                    <img
                                        src={previewFile.url}
                                        alt={previewFile.name}
                                        className="max-h-[420px] max-w-full object-contain rounded"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
                            <span className="text-xs text-slate-500 font-primary truncate max-w-[300px]">
                                {previewFile.signatoryName ? `${previewFile.signatoryName} (${previewFile.designation || 'Signatory'})` : previewFile.name}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onDownload(previewFile)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    <i className="fa-solid fa-download"></i>
                                    <span>Download</span>
                                </button>
                                <button
                                    onClick={() => setPreviewFile(null)}
                                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IngestFilesStage;
