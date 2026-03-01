'use client';

import React from "react"
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';

interface CustomerFormProps {
  onClose: () => void;
  onSubmit: (customer: any) => void;
  initialCustomer?: any;
}

export function CustomerForm({ onClose, onSubmit, initialCustomer }: CustomerFormProps) {
  // Always initialize with strings — never null — to avoid React's controlled input warning
  const [formData, setFormData] = useState({
    firstName: initialCustomer?.firstName  ?? '',
    lastName:  initialCustomer?.lastName   ?? '',
    email:     initialCustomer?.email      ?? '',
    phone:     initialCustomer?.phone      ?? '',
    address:   initialCustomer?.address    ?? '',
    city:      initialCustomer?.city       ?? '',
    state:     initialCustomer?.state      ?? '',
    zipCode:   initialCustomer?.zipCode    ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const field = (key: keyof typeof formData) => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData(prev => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">{initialCustomer ? 'Edit Customer' : 'Add Customer'}</CardTitle>
            <CardDescription className="text-muted-foreground">Add or update customer information</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">First Name</label>
                <Input {...field('firstName')} required className="border-border bg-input text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Last Name</label>
                <Input {...field('lastName')} required className="border-border bg-input text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Email</label>
                <Input {...field('email')} type="email" className="border-border bg-input text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Phone</label>
                <Input {...field('phone')} type="tel" className="border-border bg-input text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Address</label>
                <Input {...field('address')} className="border-border bg-input text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">City</label>
                <Input {...field('city')} className="border-border bg-input text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">State/Province</label>
                <Input {...field('state')} className="border-border bg-input text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Zip/Postal Code</label>
                <Input {...field('zipCode')} className="border-border bg-input text-foreground" />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                {initialCustomer ? 'Update' : 'Create'} Customer
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}