import React from 'react';
import { useParams } from 'react-router-dom';

const RegionDetail = () => {
  const { id } = useParams();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-heading font-bold text-gray-900">Region Detail</h1>
      <p className="text-gray-500 mt-1">Region ID: {id}</p>
    </div>
  );
};

export default RegionDetail;
