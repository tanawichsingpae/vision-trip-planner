import React from "react";

interface ExportHeaderProps {
  pageNumber: number;
  totalPages: number;
}

const ExportHeader: React.FC<ExportHeaderProps> = ({
  pageNumber,
  totalPages,
}) => {
  return (
    <div className="export-header">
      <div className="export-header-brand">
        <div className="export-header-logo">✈</div>
        <div>
          <div className="export-header-title">Pixinerary</div>
          <div className="export-header-subtitle">AI Travel Planning</div>
        </div>
      </div>
      <div className="export-header-page-info">
        Page {pageNumber} / {totalPages}
      </div>
    </div>
  );
};

export default ExportHeader;
